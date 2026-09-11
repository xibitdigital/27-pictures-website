-- Distinguishes a shape/region fill from a whole-page plate, so the gallery can offer only the
-- former ("area images") — a whole plate belongs to one specific page already and re-showing it as
-- a pickable reference is not what the gallery is for.
ALTER TABLE toon_assets ADD COLUMN source TEXT NOT NULL DEFAULT 'page';
