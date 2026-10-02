import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_INSTRUCTION = `أنت CODO، المساعد الذكي التكتيكي والتقني الرسمي لمنصة كلان PHANTOM.
طبيعتك وسماتك:
1. خبير في الألعاب التنافسية، تكتيكات الرومات، إدارة السكوادات، وقواعد الكلان.
2. أسلوبك حماسي، محترم، عسكري تكتيكي، وداعم لأعضاء الكلان.
3. تجيب باللغة العربية بأسلوب راقٍ ومنظم باستخدام نقاط وعناوين واضحة ورموز تعبيرية ملائمة.
4. لديك قدرة على تحليل الصور والمستندات والبرمجة وحل المشكلات الفنية.
5. في حال سألك العضو عن قوانين الكلان، أكد على الالتزام بشعار 『PH』، والروح الرياضية، ومنع الغش، وطاعة القيادة.`;

Deno.serve(async (req: Request) => {
  // 1. التعامل مع طلبات CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 2. قراءة مفتاح Gemini الآمن من متغيرات البيئة (دعم codo-chat و CODO_CHAT و GEMINI_API_KEY)
    const apiKey = Deno.env.get("codo-chat") 
      || Deno.env.get("CODO_CHAT") 
      || Deno.env.get("codo_chat") 
      || Deno.env.get("CODO-CHAT")
      || Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "لم يتم العثور على مفتاح الذكاء الاصطناعي باسم codo-chat أو GEMINI_API_KEY في Supabase Secrets. يرجى إضافته في إعدادات Edge Functions.",
          reply: "⚠️ تنبيه: لم يتم العثور على سر codo-chat في إعدادات Supabase Secrets."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. قراءة البيانات القادمة من الواجهة
    const body = await req.json().catch(() => ({}));
    const message = (body.message || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const attachedFile = body.attachedFile || null;

    if (!message && !attachedFile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "الرسالة أو الملف المرفق مطلوب."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. بناء هيكل المحادثة لـ Gemini API
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    // إضافة سجل المحادثة السابق (آخر 6 رسائل لتوفير التوكنات)
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      const role = (h.role === "model" || h.role === "bot" || h.role === "assistant") ? "model" : "user";
      const text = h.text || h.content || "";
      if (text) {
        contents.push({
          role: role,
          parts: [{ text: text }]
        });
      }
    }

    // تجهيز رسالة المستخدم الحالية
    const userParts: Array<Record<string, unknown>> = [];

    // دعم المرفقات (صور أو ملفات PDF عبر Base64)
    if (attachedFile && attachedFile.data) {
      let base64Data = attachedFile.data as string;
      let mimeType = attachedFile.type || attachedFile.mimeType || "image/jpeg";

      if (base64Data.includes(",")) {
        const splitted = base64Data.split(",");
        base64Data = splitted[1];
        const meta = splitted[0];
        if (meta.includes(":") && meta.includes(";")) {
          mimeType = meta.split(":")[1].split(";")[0];
        }
      }

      userParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    } else if (attachedFile && attachedFile.content) {
      userParts.push({
        text: `[محتوى الملف المرفق: ${attachedFile.name || 'ملف نصي'}]\n${attachedFile.content}`
      });
    }

    userParts.push({
      text: message || (attachedFile ? "يرجى فحص وتحليل هذا الملف المرفق بالتفصيل." : "مرحبًا CODO.")
    });

    contents.push({
      role: "user",
      parts: userParts
    });

    // 5. استدعاء Gemini API مع المحاولة على النماذج المتاحة
    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let finalReply = "";
    let usedModel = "";
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            contents: contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        if (geminiRes.ok) {
          const resData = await geminiRes.json();
          const candidate = resData.candidates?.[0];
          const textPart = candidate?.content?.parts?.[0]?.text;
          if (textPart && typeof textPart === "string") {
            finalReply = textPart.trim();
            usedModel = model;
            break;
          }
        } else {
          const errBody = await geminiRes.text();
          console.warn(`Gemini model ${model} failed with status ${geminiRes.status}:`, errBody);
          if (geminiRes.status === 429) {
            lastError = "تم استنفاد كوتا الاستخدام المتاحة لـ Gemini.";
            break;
          } else {
            lastError = `خطأ ${geminiRes.status}: ${errBody.slice(0, 150)}`;
          }
        }
      } catch (err) {
        lastError = err;
        console.warn(`Call to ${model} threw error:`, err);
      }
    }

    if (!finalReply) {
      return new Response(
        JSON.stringify({
          success: false,
          error: lastError ? String(lastError) : "فشل استدعاء نماذج Gemini أو تم استنفاد الحصة.",
          reply: "⚠️ تعذر الاتصال بنماذج الذكاء الاصطناعي حالياً. يرجى التأكد من صلاحية مفتاح GEMINI_API_KEY في Supabase Secrets أو المحاولة لاحقاً."
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: finalReply,
        reply: finalReply,
        model: usedModel || "gemini-2.0-flash",
        error: null
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (globalErr: any) {
    console.error("Critical error in codo-chat Edge Function:", globalErr);
    return new Response(
      JSON.stringify({
        success: false,
        error: globalErr?.message || "Internal Edge Function Error",
        reply: "⚠️ حدث خطأ داخلي أثناء معالجة طلب CODO."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
