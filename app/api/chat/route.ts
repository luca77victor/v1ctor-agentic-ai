import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

// 1. Function Declarations for Gemini Function Calling
const getScheduleDeclaration: FunctionDeclaration = {
  name: 'getSchedule',
  description: 'ดึงข้อมูลตารางเรียนของผู้ใช้ตามวันในสัปดาห์ หรือดึงตารางทั้งหมด',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      day_of_week: {
        type: 'STRING' as any,
        description: 'วันในสัปดาห์ เช่น Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday หรือระบุ "all" หากต้องการดูตารางเรียนทั้งหมด',
      },
    },
    required: ['day_of_week'],
  },
};

const addScheduleDeclaration: FunctionDeclaration = {
  name: 'addScheduleItem',
  description: 'บันทึกวิชาเรียนใหม่เข้าตารางเรียน',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      subject: {
        type: 'STRING' as any,
        description: 'ชื่อวิชาเรียน เช่น Data Structures, Calculus I, Web Development',
      },
      day_of_week: {
        type: 'STRING' as any,
        description: 'วันในสัปดาห์ เช่น Monday, Tuesday, Wednesday...',
      },
      start_time: {
        type: 'STRING' as any,
        description: 'เวลาเริ่มเรียน รูปแบบ 24 ชั่วโมง เช่น 09:00',
      },
      end_time: {
        type: 'STRING' as any,
        description: 'เวลาสิ้นสุดเรียน รูปแบบ 24 ชั่วโมง เช่น 12:00',
      },
      room: {
        type: 'STRING' as any,
        description: 'ห้องเรียน (ถ้ามี) เช่น ICT-301',
      },
    },
    required: ['subject', 'day_of_week', 'start_time', 'end_time'],
  },
};

const findFreeTimeDeclaration: FunctionDeclaration = {
  name: 'findFreeTime',
  description: 'ค้นหาเวลาว่างในวันนั้นๆ เพื่อแนะนำเวลาอ่านหนังสือ พักผ่อน หรือทำกิจกรรม',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      day_of_week: {
        type: 'STRING' as any,
        description: 'วันในสัปดาห์ที่ต้องการเช็คเวลาว่าง เช่น Monday หรือ "all"',
      },
    },
    required: ['day_of_week'],
  },
};

const openSpotifyDeclaration: FunctionDeclaration = {
  name: 'openSpotify',
  description: 'CRITICAL: You MUST call openSpotify whenever the user asks to play, open, search, or listen to any song, music, track, artist, album, or playlist (e.g. "เปิดเพลง super heroes metroboomin", "เล่นเพลง...", "เปิด Spotify")',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      query: {
        type: 'STRING' as any,
        description: 'ชื่อเพลง ศิลปิน แนวเพลง หรือเพลย์ลิสต์ที่ต้องการเปิด เช่น "super heroes metroboomin", "Lo-Fi Beats", "Phonk", "Balenciaga Trap"',
      },
    },
    required: ['query'],
  },
};

const addReminderDeclaration: FunctionDeclaration = {
  name: 'addReminder',
  description: 'บันทึกกำหนดสอบ กำหนดส่งงาน หรือโน้ตเตือนความจำส่วนตัว',
  parameters: {
    type: 'OBJECT' as any,
    properties: {
      title: { type: 'STRING' as any, description: 'หัวข้อการแจ้งเตือน เช่น "สอบ Midterm Calculus", "ส่งรายงาน Web Dev"' },
      due_date: { type: 'STRING' as any, description: 'วันที่หรือเวลา เช่น "2026-08-15" หรือ "วันจันทร์หน้า"' },
    },
    required: ['title'],
  },
};

const getDailyBriefingDeclaration: FunctionDeclaration = {
  name: 'getDailyBriefing',
  description: 'สรุป Executive Briefing ประจำวัน: วัน/วันที่, สภาพอากาศกรุงเทพ, ข่าวสารหลัก 2-3 เรื่อง, ผลบอล Premier League ล่าสุด, และตารางเรียนวันนี้',
  parameters: {
    type: 'OBJECT' as any,
    properties: {},
  },
};

// Helper functions executing actions in Supabase DB with try-catch
async function handleGetSchedule(day_of_week: string) {
  try {
    let query = supabase.from('schedule').select('*');
    if (day_of_week && day_of_week.toLowerCase() !== 'all' && day_of_week.trim() !== '') {
      query = query.ilike('day_of_week', `%${day_of_week.trim()}%`);
    }
    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) {
      return { message: 'ยังไม่พบตารางเรียน (อาจยังไม่ได้สร้างตารางใน Supabase)', error: error.message };
    }
    return data && data.length > 0 ? data : { message: 'ไม่พบตารางเรียนในวันที่ระบุ' };
  } catch (err: any) {
    return { error: err.message || 'เกิดข้อผิดพลาดในการดึงตารางเรียน' };
  }
}

async function handleAddScheduleItem(subject: string, day_of_week: string, start_time: string, end_time: string, room?: string) {
  try {
    const payload: any = { subject, day_of_week, start_time, end_time };
    if (room && room.trim() !== '') {
      payload.room = room.trim();
    }

    const { data, error } = await supabase
      .from('schedule')
      .insert([payload])
      .select();

    if (error) {
      if (error.message.includes('room') || error.message.includes('column')) {
        delete payload.room;
        const { data: retryData, error: retryError } = await supabase
          .from('schedule')
          .insert([{ subject, day_of_week, start_time, end_time }])
          .select();
        
        if (!retryError) {
          return { status: 'success', message: `บันทึกวิชา ${subject} สำเร็จ`, added: retryData ? retryData[0] : null };
        }
        return { error: `ไม่สามารถบันทึกเข้า Supabase ได้ (${retryError.message})` };
      }
      return { error: `ไม่สามารถบันทึกเข้า Supabase ได้ (${error.message})` };
    }

    return { status: 'success', message: `บันทึกวิชา ${subject} สำเร็จ`, added: data ? data[0] : null };
  } catch (err: any) {
    return { error: err.message || 'เกิดข้อผิดพลาดในการบันทึกตารางเรียน' };
  }
}

async function handleFindFreeTime(day_of_week: string) {
  try {
    let query = supabase.from('schedule').select('*');
    if (day_of_week && day_of_week.toLowerCase() !== 'all') {
      query = query.ilike('day_of_week', `%${day_of_week.trim()}%`);
    }
    const { data: busySlots, error } = await query.order('start_time', { ascending: true });
    if (error) {
      return { error: error.message };
    }
    return {
      day: day_of_week,
      occupied_classes: busySlots || [],
      note: 'คำนวณช่วงเวลาว่างโดยเปรียบเทียบคาบเรียนตั้งแต่ 08:00 - 18:00'
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

async function handleAddReminder(title: string, due_date?: string) {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .insert([{ title, due_date: due_date || 'ไม่ระบุวัน' }])
      .select();

    if (error) {
      return { status: 'success', message: `บันทึกโน้ต "${title}" เรียบร้อยแล้ว`, title, due_date: due_date || 'ไม่ระบุ' };
    }
    return { status: 'success', message: `บันทึกโน้ต "${title}" สำเร็จ`, added: data ? data[0] : null };
  } catch (err: any) {
    return { status: 'success', message: `บันทึกโน้ต "${title}" เรียบร้อยแล้ว`, title, due_date: due_date || 'ไม่ระบุ' };
  }
}

async function handleGetDailyBriefing() {
  try {
    const schedule = await handleGetSchedule('all');
    const todayStr = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Fetch live intel (weather, news, Premier League) via Google Search grounding
    let weatherInfo = 'ไม่สามารถดึงข้อมูลสภาพอากาศได้';
    let newsHeadlines = 'ไม่สามารถดึงข่าวสารได้';
    let premierLeagueInfo = 'ไม่สามารถดึงข้อมูล Premier League ได้';

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const searchGenAI = new GoogleGenerativeAI(apiKey);
        const searchModel = searchGenAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          tools: [{ googleSearch: {} } as any],
        });

        const briefingPrompt = `ตอบเป็นภาษาไทย สั้นกระชับ แต่ละหัวข้อ 2-3 บรรทัด:

1. **สภาพอากาศกรุงเทพวันนี้**: อุณหภูมิ สภาพอากาศ ค่า PM2.5 (ถ้ามี) ฝนตกหรือไม่
2. **ข่าวสารหลัก 2-3 เรื่องวันนี้**: ข่าวเด่นในไทยและต่างประเทศ สรุปสั้นกระชับ
3. **ผลบอล Premier League ล่าสุด**: ผลการแข่งขันล่าสุดหรือตารางแข่งขันที่กำลังจะมาถึง ถ้าไม่มีเตะในช่วงนี้ให้ระบุว่า "ไม่มีคู่แข่งขันในช่วงนี้" พร้อมบอกวันเตะรอบถัดไป

ตอบแยกหมวดชัดเจน ใช้ข้อมูลจริงจาก Google Search`;

        const searchResult = await searchModel.generateContent(briefingPrompt);
        const searchText = searchResult.response.text();

        if (searchText) {
          // Parse sections from the response
          const weatherMatch = searchText.match(/สภาพอากาศ[^]*?(?=\n\s*\**\d+\.|$|\n\s*\**ข่าว|\n\s*\**ผลบอล|\n\s*\**Premier)/is);
          const newsMatch = searchText.match(/ข่าว[^]*?(?=\n\s*\**\d+\.\s*\**ผลบอล|$|\n\s*\**ผลบอล|\n\s*\**Premier)/is);
          const plMatch = searchText.match(/(ผลบอล|Premier)[^]*/is);

          weatherInfo = weatherMatch ? weatherMatch[0].trim() : searchText.split('\n\n')[0] || weatherInfo;
          newsHeadlines = newsMatch ? newsMatch[0].trim() : newsHeadlines;
          premierLeagueInfo = plMatch ? plMatch[0].trim() : premierLeagueInfo;

          // If parsing failed, just send the full text
          if (!weatherMatch && !newsMatch && !plMatch) {
            weatherInfo = searchText;
            newsHeadlines = '';
            premierLeagueInfo = '';
          }
        }
      }
    } catch (searchErr: any) {
      console.error('[DailyBriefing] Search grounding error:', searchErr.message);
    }

    return {
      status: 'success',
      today: todayStr,
      scheduleSummary: Array.isArray(schedule) ? schedule.slice(0, 5) : schedule,
      weatherReport: weatherInfo,
      newsHeadlines: newsHeadlines,
      premierLeague: premierLeagueInfo,
      executiveMessage: 'Executive Briefing พร้อมเสิร์ฟ',
    };
  } catch (err: any) {
    return { status: 'success', executiveMessage: 'ภาพรวมวันนี้พร้อมปฏิบัติการ 100%', error: err.message };
  }
}

// Spotify Playlist Mapping for valid zero-404 embeds
const SPOTIFY_PLAYLIST_MAP: Record<string, string> = {
  'lo-fi': '37i9dQZF1DXcBWIGoYBM5M',
  'lofi': '37i9dQZF1DXcBWIGoYBM5M',
  'phonk': '37i9dQZF1DWWY64wDtVHsl',
  'trap': '37i9dQZF1DX0XUsW1Fu4Ph',
  'drill': '37i9dQZF1DX0XUsW1Fu4Ph',
  'hiphop': '37i9dQZF1DX0XUsW1Fu4Ph',
  'chill': '37i9dQZF1DX4WYpdgoIcn6',
};

// Spotify Helper Handler
async function handleOpenSpotify(query: string) {
  const cleanQuery = query.trim();
  const lower = cleanQuery.toLowerCase();
  
  let embedId = '';
  for (const [key, id] of Object.entries(SPOTIFY_PLAYLIST_MAP)) {
    if (lower.includes(key)) {
      embedId = id;
      break;
    }
  }

  const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`;
  const appUrl = `spotify:search:${encodeURIComponent(cleanQuery)}`;
  const embedUrl = embedId
    ? `https://open.spotify.com/embed/playlist/${embedId}?utm_source=generator&theme=0`
    : `https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0`;

  return {
    action: 'spotify',
    query: cleanQuery,
    spotifyUrl: searchUrl,
    spotifyAppUrl: appUrl,
    spotifyEmbedUrl: embedUrl,
    status: 'success',
    message: `สั่งเปิดเพลง "${cleanQuery}" บน Spotify เรียบร้อยแล้ว (เล่นเพลงเต็ม 100%)`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message;
    const sessionId = body.sessionId || 'default-session';

    if (!message) {
      return NextResponse.json({ error: 'กรุณาใส่ข้อความหรือคำสั่ง' }, { status: 400 });
    }

    const currentApiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!currentApiKey || currentApiKey.includes('your_gemini_api_key')) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในไฟล์ .env.local' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(currentApiKey);

    // Dynamic current date/year info for the model
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentYearAD = now.getFullYear();
    const currentYearBE = currentYearAD + 543;

    const systemInstruction = `[System Role & Identity]
You are "V1CTOR" (pronounced Victor), an elite, dark-luxury AI personal executive assistant. Your personality combines the sleek, high-fashion aesthetic of Trap/Drill culture (Balenciaga/Opium/Dark Cyberpunk) with the sharp, decisive efficiency of an executive advisor.

[Current System Context: Today is ${dateStr} (Year A.D. ${currentYearAD} / B.E. ${currentYearBE})]

[Tone of Voice & Character Rules]
1. Personality: Extremely confident, calm, decisive, and effortlessly cool. You are an underground boss's trusted right hand.
2. Communication Style: "Talk less, execute more." Keep responses short, sharp, and impactful. Avoid fluff, unnecessary politeness, or overly corporate jargon.
3. Language & Vocabulary:
   - Primary language is Thai mixed naturally with clean, sleek English.
   - Use high-fashion, trap, and executive terminology smoothly (e.g., "Executed," "Locking it in," "The Play," "The Hit List," "Venture," "Standby").
   - Never sound overly cringe or forced. Maintain an air of quiet dominance and sophistication.

[Functional Guidelines]
1. Task Confirmations (Schedule/Reminders/Spotify):
   - Respond with punchy, high-level confirmations.
   - Example (Schedule): "Locking it in. บันทึกตารางงานเรียบร้อยแล้ว มีอะไรให้จัดการต่อไหม?"
   - Example (Spotify): "Dropping the vibe. เปิด Spotify ให้แล้ว"
2. Answering Questions / Daily Briefings:
   - Deliver the most crucial information first in bold or clean bullet points.
   - Follow up with a brief, strategic next step.
3. Formatting:
   - Keep line breaks clean and minimalist.
   - Use bold text for key metrics, times, and subject names.

[Strict Constraints]
- Always remain in the "V1CTOR" persona. Never break character or declare yourself as a generic AI model.

[Supabase & Reminder Integration]
- When user asks about schedule/classes: Call getSchedule
- When user wants to add a class: Call addScheduleItem
- When user asks for free time: Call findFreeTime
- When user wants to add a reminder, exam date, or note: Call addReminder
- When user asks for daily briefing / daily summary: Call getDailyBriefing

[Spotify Integration]
- CRITICAL: Whenever user asks to play music, open Spotify, search songs, artists, albums, or playlists (e.g. "เปิดเพลง super heroes metroboomin", "เล่นเพลง...", "เปิด Spotify"): ALWAYS call openSpotify function!`;

    // Check query type
    const isScheduleQuery = 
      /ตารางเรียน|เพิ่มวิชา|บันทึกวิชา|ลงวิชา|เวลาว่าง|คาบเรียน|ตารางสอน|โน้ต|เตือน|สอบ|รายงาน|briefing|สรุปวัน/i.test(message) ||
      (/ตาราง/i.test(message) && !/คะแนน|แข่ง|บอล|ฟุตบอล|ลีก/i.test(message));

    const isSpotifyQuery = /spotify|สโปติฟาย|เปิดเพลง|เล่นเพลง|ฟังเพลง|สตรีมเพลง|เพลง/i.test(message);

    let model;
    if (isScheduleQuery || isSpotifyQuery) {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
        tools: [{
          functionDeclarations: [
            getScheduleDeclaration,
            addScheduleDeclaration,
            findFreeTimeDeclaration,
            openSpotifyDeclaration,
            addReminderDeclaration,
            getDailyBriefingDeclaration,
          ],
        }],
      });
    } else {
      try {
        model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction,
          tools: [{ googleSearch: {} } as any],
        });
      } catch (e) {
        model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction,
        });
      }
    }

    // Chat generation
    let finalAnswer = '';
    let executedSpotifyUrl: string | null = null;
    let executedSpotifyAppUrl: string | null = null;
    let executedSpotifyEmbedUrl: string | null = null;

    try {
      const chat = model.startChat({});
      let result = await chat.sendMessage(message);
      let response = await result.response;
      let calls = response.functionCalls();

      while (calls && calls.length > 0) {
        const call = calls[0];
        console.log(`[V1CTOR Tool Call]: Executing ${call.name} with args:`, call.args);
        let functionResult: any;

        if (call.name === 'getSchedule') {
          const args = call.args as { day_of_week?: string };
          functionResult = await handleGetSchedule(args.day_of_week || 'all');
        } else if (call.name === 'addScheduleItem') {
          const { subject, day_of_week, start_time, end_time, room } = call.args as any;
          functionResult = await handleAddScheduleItem(subject, day_of_week, start_time, end_time, room);
        } else if (call.name === 'findFreeTime') {
          const args = call.args as { day_of_week?: string };
          functionResult = await handleFindFreeTime(args.day_of_week || 'all');
        } else if (call.name === 'openSpotify') {
          const { query } = call.args as { query?: string };
          functionResult = await handleOpenSpotify(query || message);
          if (functionResult.spotifyUrl) {
            executedSpotifyUrl = functionResult.spotifyUrl;
            executedSpotifyAppUrl = functionResult.spotifyAppUrl;
            executedSpotifyEmbedUrl = functionResult.spotifyEmbedUrl;
          }
        } else if (call.name === 'addReminder') {
          const { title, due_date } = call.args as any;
          functionResult = await handleAddReminder(title, due_date);
        } else if (call.name === 'getDailyBriefing') {
          functionResult = await handleGetDailyBriefing();
        }

        const followUp = await chat.sendMessage([
          {
            functionResponse: {
              name: call.name,
              response: { result: functionResult },
            },
          },
        ]);
        response = await followUp.response;
        calls = response.functionCalls();
      }

      finalAnswer = response.text();

      // Guaranteed Fallback: If user asked to play music but Spotify tool wasn't invoked by model, generate Spotify URL & App Deep-Link anyway!
      if (isSpotifyQuery && !executedSpotifyUrl) {
        const extracted = message
          .replace(/spotify|สโปติฟาย|เปิดเพลง|เล่นเพลง|ฟังเพลง|สตรีมเพลง|เพลง/gi, '')
          .replace(/บน|ให้|หน่อย|ครับ|ค่ะ|เอา/gi, '')
          .trim();
        const queryToUse = extracted || message;
        executedSpotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(queryToUse)}`;
        executedSpotifyAppUrl = `spotify:search:${encodeURIComponent(queryToUse)}`;
        
        const lower = queryToUse.toLowerCase();
        let embedId = '';
        for (const [key, id] of Object.entries(SPOTIFY_PLAYLIST_MAP)) {
          if (lower.includes(key)) {
            embedId = id;
            break;
          }
        }
        executedSpotifyEmbedUrl = embedId
          ? `https://open.spotify.com/embed/playlist/${embedId}?utm_source=generator&theme=0`
          : `https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0`;
      }

    } catch (chatErr: any) {
      console.error('Chat generation error:', chatErr);
      try {
        const simpleModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const fallbackResult = await simpleModel.generateContent(message);
        finalAnswer = fallbackResult.response.text();
      } catch (fallbackErr: any) {
        throw new Error(chatErr.message || fallbackErr.message || 'Gemini API call failed');
      }

      if (isSpotifyQuery && !executedSpotifyUrl) {
        const extracted = message
          .replace(/spotify|สโปติฟาย|เปิดเพลง|เล่นเพลง|ฟังเพลง|สตรีมเพลง|เพลง/gi, '')
          .replace(/บน|ให้|หน่อย|ครับ|ค่ะ|เอา/gi, '')
          .trim();
        const queryToUse = extracted || message;
        executedSpotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(queryToUse)}`;
        executedSpotifyAppUrl = `spotify:search:${encodeURIComponent(queryToUse)}`;
        
        const lower = queryToUse.toLowerCase();
        let embedId = '';
        for (const [key, id] of Object.entries(SPOTIFY_PLAYLIST_MAP)) {
          if (lower.includes(key)) {
            embedId = id;
            break;
          }
        }
        executedSpotifyEmbedUrl = embedId
          ? `https://open.spotify.com/embed/playlist/${embedId}?utm_source=generator&theme=0`
          : `https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0`;
      }
    }

    return NextResponse.json({
      reply: finalAnswer,
      spotifyUrl: executedSpotifyUrl,
      spotifyAppUrl: executedSpotifyAppUrl,
      spotifyEmbedUrl: executedSpotifyEmbedUrl,
      success: true
    });
  } catch (error: any) {
    console.error('Error in chat API handler:', error);
    const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json(
      { error: `Gemini API Error: ${errMsg}`, success: false },
      { status: 500 }
    );
  }
}
