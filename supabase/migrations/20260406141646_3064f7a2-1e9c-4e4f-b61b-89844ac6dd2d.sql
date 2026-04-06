SELECT cron.schedule(
  'check-absent-daily-9am-uae',
  '0 5 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://dpnjkqwzsjydntwqxsbw.supabase.co/functions/v1/check-absent',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwbmprcXd6c2p5ZG50d3F4c2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY1MzAsImV4cCI6MjA5MTA0MjUzMH0.Zai6OJvEJJ488QHfJjrUxQ4NJCGxsEEpQroYdzw2aKI"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);