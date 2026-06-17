-- =============================================================
-- Migración 1.2: Esquema completo Alebrijes Teotihuacan Chatbot
-- Proyecto: sjajkaqenarsnaevhzko
-- Fecha: 2026-06-17
-- =============================================================
-- Este script es idempotente: usa IF NOT EXISTS y DROP IF EXISTS
-- para policies/triggers, por lo que se puede ejecutar múltiples veces
-- sin errores.
-- =============================================================

-- ============================================
-- 1.2.3 - Tabla contacts
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 1.2.4 - Tabla conversations
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',  -- active, closed
  bot_active BOOLEAN DEFAULT true,
  current_flow VARCHAR(50),
  current_step VARCHAR(50),
  flow_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 1.2.5 - Tabla messages
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wa_id VARCHAR(100),
  direction VARCHAR(10) NOT NULL,  -- inbound, outbound
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',  -- text, image, interactive, template
  sent_by VARCHAR(10) DEFAULT 'bot',  -- bot, human
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 1.2.6 - Tabla catalog_plans
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category VARCHAR(50),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 1.2.7 - Tabla dashboard_users
-- ============================================
CREATE TABLE IF NOT EXISTS dashboard_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 1.2.8 - Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- ============================================
-- 1.2.9 - Row Level Security
-- ============================================

-- Habilitar RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

-- catalog_plans: lectura pública (para que el bot pueda leer planes),
-- CRUD completo para usuarios autenticados
DROP POLICY IF EXISTS "catalog_plans_select_all" ON catalog_plans;
CREATE POLICY "catalog_plans_select_all" ON catalog_plans
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "catalog_plans_all_authenticated" ON catalog_plans;
CREATE POLICY "catalog_plans_all_authenticated" ON catalog_plans
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- contacts: lectura para autenticados (dashboard)
DROP POLICY IF EXISTS "contacts_select_authenticated" ON contacts;
CREATE POLICY "contacts_select_authenticated" ON contacts
  FOR SELECT TO authenticated USING (true);

-- conversations: lectura y update para autenticados
DROP POLICY IF EXISTS "conversations_select_authenticated" ON conversations;
CREATE POLICY "conversations_select_authenticated" ON conversations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conversations_update_authenticated" ON conversations;
CREATE POLICY "conversations_update_authenticated" ON conversations
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- messages: lectura para autenticados
DROP POLICY IF EXISTS "messages_select_authenticated" ON messages;
CREATE POLICY "messages_select_authenticated" ON messages
  FOR SELECT TO authenticated USING (true);

-- dashboard_users: lectura para autenticados, insert del propio usuario
DROP POLICY IF EXISTS "dashboard_users_select_authenticated" ON dashboard_users;
CREATE POLICY "dashboard_users_select_authenticated" ON dashboard_users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dashboard_users_insert_own" ON dashboard_users;
CREATE POLICY "dashboard_users_insert_own" ON dashboard_users
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = auth_user_id);

-- ============================================
-- Grants
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON catalog_plans TO authenticated;
GRANT SELECT, INSERT ON dashboard_users TO authenticated;

-- ============================================
-- Triggers para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_catalog_plans_updated_at ON catalog_plans;
CREATE TRIGGER update_catalog_plans_updated_at
  BEFORE UPDATE ON catalog_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Realtime: publicación para las tablas dinámicas
-- ============================================
-- Esto se hace desde Supabase Dashboard > Database > Replication,
-- pero también puede hacerse por SQL si la publicación 'supabase_realtime' existe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Agregar tablas a la publicación (idempotente con EXCEPTION)
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;  -- ya estaba agregada
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- =============================================================
-- Fin de la migración
-- =============================================================
