import { z } from "zod";

// PostgreSQL accepts canonical UUID values regardless of RFC version bits.
// Several imported judicial records use deterministic all-zero segments.
export const dbUuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Identificador no válido",
  );
