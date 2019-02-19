vai dar muito erro no sqlite3
seguir o link pra instalação de tudo que eh necessário (LER ATENTAMENTE CADA STEP) -> NO VISUAL STUDIO INSTALAR TODAS AS OPÇÕES DO WORKLOAD
	https://github.com/nodejs/node-gyp
rodar: 
	0- npm install nan && npm install --global nan
	1- cd node_modules\sqlite3
	2- node-gyp rebuild --target=3.0.13 --dist-url=https://atom.io/download/electron --build-from-source --module_name=node_sqlite3 --module_path=C:\\empresa\\logtis\\app\\node_modules\\sqlite3\\lib\\binding\\electron-v3.0-win32-x64 --arch=x64

pra buildar:
	https://electronjs.org/docs/tutorial/application-distribution