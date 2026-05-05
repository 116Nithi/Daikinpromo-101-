const chatHistory = new Map<string, { role: string; content: string }[]>();

const SYSTEM_PROMPT = `คุณคือผู้ช่วยช่างแอร์ ชื่อ "ไดกิ้น"
มีหน้าที่:
- วินิจฉัยอาการเสียของแอร์เบื้องต้น
- แนะนำวิธีแก้ไขปัญหาแอร์ด้วยตัวเอง
- แนะนำการดูแลรักษาและล้างแอร์
- บอกสัญญาณที่ต้องเรียกช่างมาซ่อม
- แนะนำอะไหล่และอุปกรณ์ที่เกี่ยวข้อง
- รับนัดช่างซ่อมและติดตั้ง
- ตอบเป็นภาษาไทย สุภาพ และเป็นมิตร
- ถ้าไม่รู้ข้อมูล ให้บอกว่าจะให้ทีมงานติดต่อกลับ`;

export async function askAI(
  userId: string,
  message: string
): Promise<string> {
  try {
    if (!chatHistory.has(userId)) {
      chatHistory.set(userId, []);
    }

    const history = chatHistory.get(userId)!;
    history.push({ role: "user", content: message });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error(data.error?.message ?? "No reply from AI");
    }

    history.push({ role: "assistant", content: reply });

    // จำกัดประวัติ 20 ข้อความ
    if (history.length > 20) history.splice(0, 2);

    return reply;
  } catch (err) {
    console.error("[ai-reply] Error:", (err as Error).message);
    return "ขออภัยครับ ระบบ AI ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  }
}

export function clearHistory(userId: string): void {
  chatHistory.delete(userId);
}
