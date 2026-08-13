-- ==========================================================
-- Jarvis AI Agent Database Schema for Supabase
-- ==========================================================

-- 1. Create table for Class Schedule (ตารางเรียน)
CREATE TABLE IF NOT EXISTS schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,          -- ชื่อวิชา เช่น "CS101 Intro to Computer Science"
  day_of_week TEXT NOT NULL,      -- วันในสัปดาห์ เช่น "Monday", "Tuesday", "Wednesday"
  start_time TEXT NOT NULL,      -- เวลาเริ่ม เช่น "09:00"
  end_time TEXT NOT NULL,        -- เวลาจบ เช่น "12:00"
  room TEXT,                     -- ห้องเรียน (optional) เช่น "ICT-402"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create table for Conversation History (ความจำบทสนทนา)
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL DEFAULT 'default-session',
  role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule(day_of_week);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id, created_at);
