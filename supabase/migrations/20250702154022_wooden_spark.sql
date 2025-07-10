-- Create storage bucket for question papers
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-papers', 'question-papers', true);

-- Set up storage policies
CREATE POLICY "Teachers can upload question papers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-papers');

CREATE POLICY "Anyone can view question papers"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'question-papers');

CREATE POLICY "Service role can manage question papers"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'question-papers');