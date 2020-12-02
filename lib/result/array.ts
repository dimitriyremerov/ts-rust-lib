import { Result, ResultErr, ResultOk } from "../result";
import { Fn } from "../fn";
import { panic } from "../err";
import { AsyncResultArray } from "./array/async";
import { Future } from "../future";
import { AsyncResult } from "./async";
import { NonEmptyArray } from "../array";
import { Option } from "../option";

export class ResultArray<T, E> {
	public constructor(protected results: Result<T, E>[]) {
	}

	static from<T, E>(results: Result<T, E>[]): ResultArray<T, E> {
		return new ResultArray(results);
	}

	static ok<T, E = unknown>(vals: T[]): ResultArray<T, E> {
		return ResultArray.from(vals.map(val => Result.ok<T, E>(val)));
	}

	static err<E, T = unknown>(errs: E[]): ResultArray<T, E> {
		return ResultArray.from(errs.map(err => Result.err<E, T>(err)));
	}

	oks(): T[] {
		return this.results.filter(result => result.isOk()).map(result => result.ok()!);
	}
	oksResult(): ResultOk<T[], E[]> {
		return Result.ok(this.oks());
	}
	errs(): E[] {
		return this.results.filter(result => result.isErr()).map(result => result.err()!);
	}
	errsResult(): ResultErr<E[], T[]> {
		return Result.err(this.errs());
	}

	mapResults<U, F>(op: Fn<Result<T, E>[], Result<U, F>[]>): ResultArray<U, F> {
		return ResultArray.from(op(this.results));
	}
	group<G>(op: Fn<T, G>, stringify = false): ResultArray<[G, NonEmptyArray<T>], E> {
		if (this.results.length === 0) {
			return ResultArray.from([]);
		}
		const strFn = stringify ? JSON.stringify : (v: G) => v;
		const parsFn: (v: G | string) => G = stringify ? JSON.parse : (v: G | string): G => v as G;
		const state = this.results.reduce((acc, result) => {
			if (result.isErr()) {
				acc.errs.push(result);
			} else {
				const val = result.unwrap();
				const key = strFn(op(val));
				const arr = acc.map.get(key)?.concat(val) as Option<NonEmptyArray<T>> ?? [val];
				acc.map.set(key, arr);
			}
			return acc;
		}, { map: new Map<G | string, NonEmptyArray<T>>(), errs: [] as ResultErr<E, any>[] });
		return ResultArray.from(Array.from(state.map.entries())
			.map<Result<[G, NonEmptyArray<T>], E>>(([key, arr]) => Result.ok([parsFn(key), arr]))
			.concat(...state.errs)
		);
	}
	batch(size: number): ResultArray<[number, NonEmptyArray<T>], E> {
		let i = 0;
		return this.group(() => Math.floor(i++ / size));
	}

	map<U>(op: Fn<T, U>): ResultArray<U, E> {
		return ResultArray.from(this.results.map(result => result.map(op)));
	}
	flatMap<U>(op: Fn<T, U[]>): ResultArray<U, E> {
		return ResultArray.from(this.results.reduce((acc, result) => [
			...acc,
			...result.map(val => op(val).map<Result<U, E>>(val => Result.ok(val)))
				.unwrapOr([result as unknown as ResultErr<E, U>]),
		], [] as Result<U, E>[]));
	}
	mapAll<U>(op: Fn<T[], U[]>): ResultArray<U, E> {
		return this.group(() => 1).flatMap(([, vals]) => op(vals));
	}
	mapOr<U>(def: U, op: Fn<T, U>): U[] {
		return this.results.map(result => result.mapOr(def, op));
	}
	mapOrElse<U>(def: Fn<E, U>, op: Fn<T, U>): U[] {
		return this.results.map(result => result.mapOrElse(def, op));
	}
	mapErr<F>(op: Fn<E, F>): ResultArray<T, F> {
		return ResultArray.from(this.results.map(result => result.mapErr(op)));
	}
	flatMapErr<F>(op: Fn<E, F[]>): ResultArray<T, F> {
		return ResultArray.from(this.results.reduce((acc, result) => [
			...acc,
			...result.mapErr(err => op(err).map<Result<T, F>>(err => Result.err(err)))
				.flip().unwrapOr([result as unknown as ResultOk<T, F>])
		], [] as Result<T, F>[]));
	}

	and<U>(res: Result<U, E>): ResultArray<U, E> {
		return ResultArray.from(this.results.map(result => result.and(res)));
	}
	andThen<U>(op: Fn<T, Result<U, E>>): ResultArray<U, E> {
		return ResultArray.from(this.results.map(result => result.andThen(op)));
	}
	flatAndThen<U>(op: Fn<T, ResultArray<U, E>>): ResultArray<U, E> {
		return ResultArray.from(this.results.reduce((acc, result) => [
			...acc,
			...result.map(val => op(val).results)
				.unwrapOr([result as unknown as ResultErr<E, U>])
		], [] as Result<U, E>[]));
	}

	or<F>(res: Result<T, F>): ResultArray<T, F> {
		return ResultArray.from(this.results.map(result => result.or(res)));
	}
	orElse<F>(op: Fn<E, Result<T, F>>): ResultArray<T, F> {
		return ResultArray.from(this.results.map(result => result.orElse(op)));
	}

	unwrapOr(def: T): T[] {
		return this.results.map(result => result.unwrapOr(def));
	}
	unwrapOrElse(op: Fn<E, T>): T[] {
		return this.results.map(result => result.unwrapOrElse(op));
	}

	unwrap(msg?: string): T[] {
		const oks = this.oks();
		return oks.length === this.results.length ? oks : panic(msg ?? "Expected Oks, got at least one Err", this.errs().shift());
	}
	unwrapErr(msg?: string): E[] {
		const errs = this.errs();
		return errs.length === this.results.length ? errs : panic(msg ?? "Expected Errs, got at least one Ok", this.oks().shift());
	}

	flip(): ResultArray<E, T> {
		return ResultArray.from(this.results.map(result => result.flip()));
	}

	async(): AsyncResultArray<T, E> {
		return new AsyncResultArray(resolve => resolve(this));
	}
	mapAsync<U>(op: Fn<T, Future<U>>): AsyncResultArray<U, E> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.mapAsync(op)));
	}
	flatMapAsync<U>(op: Fn<T, Future<U[]>>): AsyncResultArray<U, E> {
		return this.mapAsync(op).flatMap(arr => arr);
	}
	mapErrAsync<F>(op: Fn<E, Future<F>>): AsyncResultArray<T, F> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.mapErrAsync(op)));
	}
	andAsync<U>(res: AsyncResult<U, E>): AsyncResultArray<U, E> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.andAsync(res)));
	}
	andThenAsync<U>(op: Fn<T, AsyncResult<U, E>>): AsyncResultArray<U, E> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.andThenAsync(op)));
	}
	flatAndThenAsync<U>(op: Fn<T, AsyncResultArray<U, E>>): AsyncResultArray<U, E> {
		return this.mapAsync(op).flatAndThen(res => res);
	}
	orAsync<F>(res: AsyncResult<T, F>): AsyncResultArray<T, F> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.orAsync(res)));
	}
	orElseAsync<F>(op: Fn<E, AsyncResult<T, F>>): AsyncResultArray<T, F> {
		return AsyncResultArray.fromAsyncArray(this.results.map(result => result.orElseAsync(op)));
	}
}

export const Oks = ResultArray.ok;
export const Errs = ResultArray.err;

export const resMap = <T, U, E>(vals: T[], op: Fn<T, Result<U, E>>): ResultArray<U, E> =>
	ResultArray.ok<T, E>(vals).andThen(op);

export const resFlatMap = <T, U, E>(vals: T[], op: Fn<T, ResultArray<U, E>>): ResultArray<U, E> =>
	ResultArray.ok<T, E>(vals).flatAndThen(op);
