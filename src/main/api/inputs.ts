import { z } from "zod";
import { APP_ID_PATTERN } from "@shared/apps";
import { COUNTRY_CODES } from "@shared/countries";

export const countryInput = z.enum(COUNTRY_CODES);
export const appIdInput = z.string().regex(APP_ID_PATTERN, "Invalid app id");
export const folderIdInput = z.number().int().positive();
