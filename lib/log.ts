export const log = (msg: string, full = false) =>
	<T>(val: T): T => {
		console.log(msg, full ? JSON.stringify(val, undefined, 2) : val);
		return val;
	};
