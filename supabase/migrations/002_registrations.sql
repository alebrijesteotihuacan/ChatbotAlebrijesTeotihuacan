-- =============================================================
-- Migración 2: Tabla de registros/inscripciones
-- Proyecto: sjajkaqenarsnaevhzko
-- Fecha: 2026-06-17
-- =============================================================
-- Almacena los datos de jugadores que completan el flujo de
-- inscripción en cualquiera de las 3 categorías (Escuela, TDP, Piloto).
-- =============================================================

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_phone VARCHAR(20),
  category VARCHAR(20) NOT NULL CHECK (category IN ('escuela', 'tdp', 'piloto')),
  player_name TEXT,
  birth_year INT,
  age INT,
  position TEXT,
  profile VARCHAR(50),
  schedule VARCHAR(10),
  tutor_name TEXT,
  raw_data TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrations_conversation ON registrations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_registrations_category ON registrations(category);
CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(contact_phone);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at DESC);

-- =============================================================
-- Row Level Security
-- =============================================================
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Lectura para usuarios autenticados (dashboard)
DROP POLICY IF EXISTS "registrations_select_authenticated" ON registrations;
CREATE POLICY "registrations_select_authenticated" ON registrations
  FOR SELECT TO authenticated USING (true);

-- Insert solo desde service_role (engine del bot)
DROP POLICY IF EXISTS "registrations_insert_service" ON registrations;
CREATE POLICY "registrations_insert_service" ON registrations
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Grants
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON registrations TO authenticated;
GRANT INSERT ON registrations TO service_role;

-- Realtime para dashboard
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- =============================================================
-- Fin de la migración
-- =============================================================
