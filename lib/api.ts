import { APIGatewayProxyEvent } from "aws-lambda";
import { JsonObject } from "./json";
import { fromNullable } from "./option";
import { AppErr, errModule } from "./err";
import { res } from "./result/option";
import { tryCatch } from "./result/try-catch";
import { validate, not } from "./result/validate";
import { Result } from "./result";

export type RequestContext<R extends JsonObject> = {
	accountId: number,
	request: R,
};

export const getRequestContext = <R extends JsonObject>(event: APIGatewayProxyEvent): Result<RequestContext<R>, ApiErr> =>
	res(fromNullable(event.body), API_REQUEST_NO_BODY)
		.andThen(body => tryCatch(() => JSON.parse(body) as R, API_REQUEST_BODY_PARSE_ERROR))
		.map(request => Object.assign(request, event.pathParameters ?? {}))
		.andThen(request => res(event.requestContext.authorizer?.principalId, API_AUTH_PARSE_ERROR)
			.map(parseInt)
			.andThen(validate(not(isNaN), API_AUTH_PARSE_ERROR))
			.map(accountId => ({ accountId, request }))
		)
		.mapErr(createErr);

// Errors
export type ApiErr = AppErr<"api">;
const createErr = errModule("api");

export const
	API_REQUEST_NO_BODY = 1,
	API_REQUEST_BODY_PARSE_ERROR = 2,
	API_REQUEST_REQUIRED_PARAMETER = 3,
	API_AUTH_JWT_TOKEN_PARSE_ERROR = 4,
	API_AUTH_JWT_TOKEN_INVALID = 5,
	API_AUTH_PARSE_ERROR = 6;
