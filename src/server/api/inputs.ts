import { z } from "zod";
import { COUNTRY_CODES } from "@/lib/countries";

export const countryInput = z.enum(COUNTRY_CODES);
export const appIdInput = z.string().regex(/^\d+$/, "Invalid App Store id");
export const folderIdInput = z.number().int().positive();
