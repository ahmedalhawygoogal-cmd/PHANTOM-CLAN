import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -------------------------------------------------------------
// خوارزمية إنشاء Agora RTC Token الرسمية (v006) بدون أي تبعيات خارجية
// -------------------------------------------------------------
function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32Str(str: string): number {
  let crc = 0 ^ (-1);
  const buf = Buffer.from(str, "utf8");
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

class ByteBuf {
  private buffer: Buffer;
  private pos: number;

  constructor(initialCapacity = 1024) {
    this.buffer = Buffer.alloc(initialCapacity);
    this.pos = 0;
  }

  private ensureCapacity(needed: number) {
    if (this.pos + needed > this.buffer.length) {
      const nextBuf = Buffer.alloc(Math.max(this.buffer.length * 2, this.pos + needed));
      this.buffer.copy(nextBuf, 0, 0, this.pos);
      this.buffer = nextBuf;
    }
  }

  putUint16(v: number): this {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(v, this.pos);
    this.pos += 2;
    return this;
  }

  putUint32(v: number): this {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(v >>> 0, this.pos);
    this.pos += 4;
    return this;
  }

  putBytes(bytes: Buffer): this {
    this.putUint16(bytes.length);
    this.ensureCapacity(bytes.length);
    bytes.copy(this.buffer, this.pos);
    this.pos += bytes.length;
    return this;
  }

  putString(str: string): this {
    return this.putBytes(Buffer.from(str, "utf8"));
  }

  putTreeMapUInt32(map: Record<number, number>): this {
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    this.putUint16(keys.length);
    for (const key of keys) {
      this.putUint16(key);
      this.putUint32(map[key]);
    }
    return this;
  }

  pack(): Buffer {
    return this.buffer.subarray(0, this.pos);
  }
}

function generateAgoraRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number | string,
  role = 1, // 1 = PUBLISHER, 2 = SUBSCRIBER
  privilegeExpiredTs: number
): string {
  const version = "006";
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);
  const ts = Math.floor(Date.now() / 1000) + 24 * 3600;
  const uidStr = (uid === 0 || uid === "0" || uid === null || uid === undefined) ? "" : `${uid}`;

  // الامتيازات الرسمية (1 = Join, 2 = Audio, 3 = Video, 4 = Data)
  const messages: Record<number, number> = {};
  messages[1] = privilegeExpiredTs; // kJoinChannel
  if (role === 0 || role === 1 || role === 101) {
    messages[2] = privilegeExpiredTs; // kPublishAudioStream
    messages[3] = privilegeExpiredTs; // kPublishVideoStream
    messages[4] = privilegeExpiredTs; // kPublishDataStream
  }

  const mBuf = new ByteBuf()
    .putUint32(salt)
    .putUint32(ts)
    .putTreeMapUInt32(messages)
    .pack();

  const toSign = Buffer.concat([
    Buffer.from(appId, "utf8"),
    Buffer.from(channelName, "utf8"),
    Buffer.from(uidStr, "utf8"),
    mBuf,
  ]);

  const signature = createHmac("sha256", appCertificate).update(toSign).digest();
  const crcChannel = crc32Str(channelName);
  const crcUid = crc32Str(uidStr);

  const contentBuf = new ByteBuf()
    .putBytes(signature)
    .putUint32(crcChannel)
    .putUint32(crcUid)
    .putBytes(mBuf)
    .pack();

  return version + appId + contentBuf.toString("base64");
}

// -------------------------------------------------------------
// خادم Deno ومعالجة طلبات HTTP
// -------------------------------------------------------------
Deno.serve(async (req: Request) => {
  // 1. معالجة طلبات CORS Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. التحقق من أن الطلب POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 3. قراءة محتوى الطلب (JSON)
    const body = await req.json().catch(() => ({}));
    const channelName = (body.channelName || "").trim();
    const uid = body.uid !== undefined && body.uid !== null ? body.uid : 0;

    // 4. قراءة البيانات السرية من Supabase Secrets مع دعم جميع أنماط التسمية
    const appId = Deno.env.get("AGORA_APP_ID") || 
                  Deno.env.get("agora_app_id") || 
                  Deno.env.get("AGORA_ID") || 
                  body.appId || 
                  "129b4ba5126742d6973d17c9cbf2d5f3";

    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE") || 
                           Deno.env.get("agora_app_certificate") || 
                           Deno.env.get("AGORA_CERTIFICATE") || 
                           Deno.env.get("agora_certificate") || 
                           Deno.env.get("AGORA_CERT");

    if (!appCertificate) {
      console.error("[Agora Token Error] AGORA_APP_CERTIFICATE is missing in Supabase Secrets.");
      return new Response(
        JSON.stringify({
          success: false,
          error: "شهادة AGORA_APP_CERTIFICATE غير مهيأة في Supabase Secrets. يرجى إضافتها في Project Settings > Edge Functions > Secrets باسم AGORA_APP_CERTIFICATE.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // الدور (Role): افتراضياً 1 = Publisher (نشر واشتراك)، أو 2 = Subscriber
    let role = 1;
    if (body.role === "subscriber" || body.role === 2) {
      role = 2;
    } else if (body.role === "publisher" || body.role === 1 || body.role === 0) {
      role = 1;
    }

    // مدة الصلاحية بالثواني (افتراضياً 24 ساعة = 86400 ثانية، أو حسب طلب العميل)
    const expirationSeconds = Number(body.expirationSeconds) > 0 
      ? Number(body.expirationSeconds) 
      : 86400;

    if (!channelName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "اسم القناة (channelName) مطلوب.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. حساب وقت انتهاء الصلاحية وإنشاء Token حقيقي
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationSeconds;

    const token = generateAgoraRtcToken(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    // 6. إرجاع النتيجة بنجاح
    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        appId: appId,
        channelName: channelName,
        uid: uid,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[Agora Token Fatal Error]:", err?.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "فشل توليد Agora RTC Token بسبب خطأ داخلي.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
