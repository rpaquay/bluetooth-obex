tsc --target ES5 src\main.ts --sourcemap
tsc --target ES5 src\send_file.ts --sourcemap
tsc --target ES5 src\obex_test.ts --out src\obex_test.js
node src\obex_test.js
