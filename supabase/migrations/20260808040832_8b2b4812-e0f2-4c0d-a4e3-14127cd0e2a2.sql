-- ============ enums & helpers ============
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.dhaka_today()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date;
$$;

CREATE OR REPLACE FUNCTION public.is_aiub_student_email(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _email ~ '^[1-9]{2}-[0-9]{5}-[1-3]@student\.aiub\.edu$';
$$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 80),
  avatar_url text,
  avatar_public_id text,
  is_banned boolean NOT NULL DEFAULT false,
  banned_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ roles ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE id = _user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND NOT public.is_banned(_user_id);
$$;

CREATE POLICY "profiles readable by signed-in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- users must not escalate/unban themselves
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Not allowed to modify moderation fields';
    END IF;
    IF public.is_banned(auth.uid()) THEN
      RAISE EXCEPTION 'Account is banned';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_guard_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ signup: enforce AIUB email + create profile ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_aiub_student_email(lower(NEW.email)) THEN
    RAISE EXCEPTION 'Registration is restricted to AIUB student emails (e.g. 23-12345-1@student.aiub.edu)';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ categories ============
CREATE TABLE public.categories (
  slug text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.categories TO authenticated, anon;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.categories FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (slug, label, sort_order) VALUES
  ('electronics','Electronics',10),
  ('id-cards','ID / Cards',20),
  ('books','Books',30),
  ('clothing','Clothing',40),
  ('bags','Bags',50),
  ('keys','Keys',60),
  ('accessories','Accessories',70),
  ('documents','Documents',80),
  ('other','Other',999);

-- ============ posts ============
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  category text NOT NULL REFERENCES public.categories(slug),
  lost_date date NOT NULL,
  image_url text,
  image_public_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_user_idx ON public.posts (user_id, created_at DESC);
CREATE INDEX posts_category_idx ON public.posts (category);
CREATE INDEX posts_lost_date_idx ON public.posts (lost_date);
CREATE INDEX posts_search_idx ON public.posts
  USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "posts readable by signed-in users" ON public.posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "students create own posts" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY "students update own posts" ON public.posts
  FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.is_active_member(auth.uid()))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "students delete own posts" ON public.posts
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY "admins delete any post" ON public.posts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- validation: no future lost date, image & owner immutable
CREATE OR REPLACE FUNCTION public.validate_post()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.lost_date > public.dhaka_today() THEN
    RAISE EXCEPTION 'Lost date cannot be in the future';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Post ownership cannot be changed';
    END IF;
    IF NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.image_public_id IS DISTINCT FROM OLD.image_public_id THEN
      RAISE EXCEPTION 'The photo of a post cannot be changed after creation';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER posts_validate BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_post();

-- ============ daily posting quota (atomic) ============
CREATE TABLE public.posting_quota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  posting_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, posting_date)
);
GRANT SELECT ON public.posting_quota TO authenticated;
GRANT ALL ON public.posting_quota TO service_role;
ALTER TABLE public.posting_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own quota" ON public.posting_quota
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reserve_daily_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.posting_quota (user_id, posting_date)
    VALUES (NEW.user_id, public.dhaka_today());
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'DAILY_POST_LIMIT: You can create one lost-and-found post per day. You can post again tomorrow.';
  END;
  RETURN NEW;
END; $$;
CREATE TRIGGER posts_daily_quota BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.reserve_daily_quota();

-- ============ comments ============
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX comments_post_idx ON public.comments (post_id, created_at);
CREATE INDEX comments_parent_idx ON public.comments (parent_comment_id);
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "comments readable by signed-in users" ON public.comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "students create own comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY "students update own comments" ON public.comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.is_active_member(auth.uid()))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "students delete own comments" ON public.comments
  FOR DELETE TO authenticated USING (user_id = auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY "admins delete any comment" ON public.comments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- only one level of replies
CREATE OR REPLACE FUNCTION public.validate_comment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_parent uuid; parent_post uuid;
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT parent_comment_id, post_id INTO parent_parent, parent_post
      FROM public.comments WHERE id = NEW.parent_comment_id;
    IF parent_post IS NULL THEN RAISE EXCEPTION 'Parent comment not found'; END IF;
    IF parent_parent IS NOT NULL THEN RAISE EXCEPTION 'Only one level of replies is supported'; END IF;
    IF parent_post <> NEW.post_id THEN RAISE EXCEPTION 'Reply must belong to the same post'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER comments_validate BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_comment();

-- ============ bookmarks ============
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE INDEX bookmarks_user_idx ON public.bookmarks (user_id, created_at DESC);
CREATE POLICY "users read own bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users create own bookmarks" ON public.bookmarks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY "users delete own bookmarks" ON public.bookmarks
  FOR DELETE TO authenticated USING (user_id = auth.uid());