import * as crypto from "crypto";
import { JsonObject } from "./json";
import { tryCatch } from "./result/try-catch";
import { AppErr, errModule } from "./err";
import { Result } from "./result";

// TODO move to config
const SALT = process.env.APP_KEY ?? "Generic Secret";
const saltBuffer = Buffer.from(SALT, "utf-8");

export const createId = (idString: string): Result<string, IdErr> =>
	tryCatch(
		() => crypto
			.createHmac("sha256", saltBuffer)
			.update(idString)
			.digest("hex"),	
		ID_CREATE_FAILED
	).mapErr(createErr);

export const createObjectId = (obj: JsonObject): Result<string, IdErr> =>
	tryCatch(() => JSON.stringify(obj, Object.keys(obj).sort()), ID_CREATE_FAILED)
		.mapErr(createErr)
		.andThen(createId);

// Errors
export type IdErr = AppErr<"id">;
const createErr = errModule("id");

export const ID_CREATE_FAILED = 1;
