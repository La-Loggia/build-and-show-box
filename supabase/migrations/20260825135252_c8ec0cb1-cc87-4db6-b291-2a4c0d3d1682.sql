CREATE TYPE public.app_role AS ENUM ('admin');

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
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.grant_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_first_admin();

CREATE TABLE public.carnet_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  label text,
  name text NOT NULL DEFAULT 'Carlos',
  surname text NOT NULL DEFAULT 'Medina',
  points integer NOT NULL DEFAULT 13,
  birth_date text NOT NULL DEFAULT '29/09/2006',
  document_number text NOT NULL DEFAULT '51255926N',
  licence_expiry text NOT NULL DEFAULT '21/03/2035',
  licence_am text NOT NULL DEFAULT '07/05/2022',
  licence_a1 text NOT NULL DEFAULT '13/01/2024',
  licence_b text NOT NULL DEFAULT '21/03/2025',
  photo_url text,
  photo_zoom numeric NOT NULL DEFAULT 1,
  photo_x numeric NOT NULL DEFAULT 0,
  photo_y numeric NOT NULL DEFAULT 0,
  plate text NOT NULL DEFAULT '8263 JTR',
  vehicle_model text NOT NULL DEFAULT 'BMW 218D ACTIVE TOURER',
  registration_date text NOT NULL DEFAULT '03/11/2016',
  itv_expiry text NOT NULL DEFAULT '03/11/2026',
  insurer text NOT NULL DEFAULT 'MUTUA LEVANTE',
  insurance_start text NOT NULL DEFAULT '02/04/2025',
  fiscal_municipality text NOT NULL DEFAULT 'ALICANTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carnet_users TO authenticated;
GRANT ALL ON public.carnet_users TO service_role;
ALTER TABLE public.carnet_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage carnet users"
ON public.carnet_users FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER carnet_users_updated_at
BEFORE UPDATE ON public.carnet_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_carnet_by_slug(_slug text)
RETURNS TABLE (
  name text, surname text, points integer, birth_date text, document_number text,
  licence_expiry text, licence_am text, licence_a1 text, licence_b text,
  photo_url text, photo_zoom numeric, photo_x numeric, photo_y numeric,
  plate text, vehicle_model text, registration_date text, itv_expiry text,
  insurer text, insurance_start text, fiscal_municipality text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.name, c.surname, c.points, c.birth_date, c.document_number,
         c.licence_expiry, c.licence_am, c.licence_a1, c.licence_b,
         c.photo_url, c.photo_zoom, c.photo_x, c.photo_y,
         c.plate, c.vehicle_model, c.registration_date, c.itv_expiry,
         c.insurer, c.insurance_start, c.fiscal_municipality
  FROM public.carnet_users c
  WHERE c.slug = _slug AND c.active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_carnet_by_slug(text) TO anon, authenticated;