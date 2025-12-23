/**
 * Configuration for the app.
 * IMPORTANT: Fill in SUPABASE_URL and SUPABASE_ANON_KEY from your Supabase project settings.
 */

export const APP_TITLE = "UNC Tenting Schedules";

// Supabase
export const SUPABASE_URL = "https://hhdtvfihvpgebytwlvxt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZHR2ZmlodnBnZWJ5dHdsdnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDI0MzEsImV4cCI6MjA4MjA3ODQzMX0.zJlDw4_rp2f4eiG0kkXVol11ACK6ODezMxPTa5z5_lc";
export const SUPABASE_TABLE = "attendance";

// Admin “login name”
export const ADMIN_NAME = "secret";

// Location target: 35°59'49.7"N 78°56'29.5"W  -> decimal degrees
// 35 + 59/60 + 49.7/3600 = 35.9971389
// -(78 + 56/60 + 29.5/3600) = -78.9415278
export const TARGET_COORD = {
  lat: 35.9971389,
  lon: -78.9415278,
};

// How close is “close enough” (meters)?
export const MAX_DISTANCE_METERS = 200;

// CSV path (relative to site root)
export const SCHEDULE_CSV_PATH = "data/schedule.csv";

// Week paging
// We define “week 0” as starting at the first timestamp in the CSV,
// and each week is 7 days long from that anchor.
export const DAYS_PER_WEEK = 7;
