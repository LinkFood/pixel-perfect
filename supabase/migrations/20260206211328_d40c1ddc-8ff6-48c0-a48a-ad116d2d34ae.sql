
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_name TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'dog',
  pet_breed TEXT,
  status TEXT NOT NULL DEFAULT 'upload',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

-- Project photos table
CREATE TABLE public.project_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_photos" ON public.project_photos FOR ALL USING (true) WITH CHECK (true);

-- Project interview messages
CREATE TABLE public.project_interview (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_interview ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_interview" ON public.project_interview FOR ALL USING (true) WITH CHECK (true);

-- Project pages (24-page storybook)
CREATE TABLE public.project_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  page_type TEXT NOT NULL DEFAULT 'story',
  text_content TEXT,
  illustration_prompt TEXT,
  scene_description TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_pages" ON public.project_pages FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for project_pages
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_pages;

-- Project illustrations (multiple options per page)
CREATE TABLE public.project_illustrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.project_pages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT false,
  generation_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_illustrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to project_illustrations" ON public.project_illustrations FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_pages_updated_at BEFORE UPDATE ON public.project_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for pet photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pet-photos', 'pet-photos', true);

-- Storage policies
CREATE POLICY "Allow public read of pet photos" ON storage.objects FOR SELECT USING (bucket_id = 'pet-photos');
CREATE POLICY "Allow upload to pet photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pet-photos');
CREATE POLICY "Allow update pet photos" ON storage.objects FOR UPDATE USING (bucket_id = 'pet-photos');
CREATE POLICY "Allow delete pet photos" ON storage.objects FOR DELETE USING (bucket_id = 'pet-photos');
