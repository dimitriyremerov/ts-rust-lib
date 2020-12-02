import { JsonValue, JsonObject } from "./json";
import { Result, Ok } from "./result";
import { validate } from "./result/validate";
import { API_AUTH_JWT_TOKEN_PARSE_ERROR, API_AUTH_JWT_TOKEN_INVALID } from "./api";
import { tryCatch } from "./result/try-catch";
import * as crypto from "crypto";
import { now } from "./time";

export type JwtHeader = {
  alg: string;
  typ?: "JWT";
  kid?: string;
};

export type JwtPayload = Record<string, JsonValue>;

type RawJwt = {
	header: JwtHeader;
	payload: JwtPayload;
	data: Buffer;
	signature: string;
};

export const parseJwt = (token: string): Result<RawJwt, number> =>
	Ok<string[], number>(token.split(".", 4))
		.andThen(validate(isJwtParts, API_AUTH_JWT_TOKEN_PARSE_ERROR))
		.andThen(parts => tryCatch(
			() => ({
				header: JSON.parse(Buffer.from(parts[0], "base64").toString("binary")) as JsonValue,
				payload: JSON.parse(Buffer.from(parts[1], "base64").toString("binary")) as JsonValue,
				signature: parts[2],
				data: Buffer.from(`${parts[0]}.${parts[1]}`),
			}),
			API_AUTH_JWT_TOKEN_PARSE_ERROR
		))
		.andThen(validate((rawJwt): rawJwt is RawJwt => {
			const { header, payload } = rawJwt;
			return isJsonObject(header)
				&& "alg" in header && typeof header.alg === "string"
				&& (header.typ === undefined || header.typ === "JWT")
				&& (header.kid === undefined || typeof header.kid === "string")
				&& isJsonObject(payload);
		}, API_AUTH_JWT_TOKEN_INVALID));

export const verifyJwt = (key: string) =>
	(rawJwt: RawJwt) => Ok(rawJwt)
		.andThen(validate(rawJwt => {
			const exp = rawJwt.payload.exp;
			return rawJwt.header.alg === "HS256"
				&& typeof exp === "number" && exp > now();
		}, API_AUTH_JWT_TOKEN_INVALID))
		.andThen(rawJwt => tryCatch(() => crypto
			.createHmac("sha256", key)
			.update(rawJwt.data)
			.digest("base64"), API_AUTH_JWT_TOKEN_INVALID
		).map(escapeBase64).map(sig => sig === rawJwt.signature))
		.unwrapOr(false);

const escapeBase64 = (base64: string): string =>
	base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

const isJwtParts = (parts: string[]): parts is [string, string, string] =>
	parts.length === 3;

const isJsonObject = (value: JsonValue): value is JsonObject =>
	typeof value === "object"
		&& value !== null
		&& !Array.isArray(value);
