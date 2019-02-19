const { app, BrowserWindow, ipcMain } = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

//objeto que tem como chaves, os page_ids de cada pagina
//esse page_id eh atribuido para cada pagina atraves do page_counter abaixo
let formula_windows = {}

let page_counter = 0

function createWindow () {
  
  // Create the browser window.
	win = new BrowserWindow({ width: 1200, height: 800 })

  // and load the index.html of the app.
  win.loadFile('./pages/dashboard.html')

  // Open the DevTools.
  //	win.webContents.openDevTools()

  // Sqlite Stuff
    let server = require('./server/local-api.js')
  // cria as tabelas
    //server.init_db();
  // popula as tabelas
    //server.populate_db();
  // dropa as tabelas
    //server.drop_db();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Pegamos todos os valores de chave do objeto (que sao windows) e transformamos num array
    // percorremos o array dando close naquelas que ainda nao foram fechadas
    const windows = Object.values(formula_windows)

    for (let i = 0;i < windows.length;i++) {
      try {
        windows[i].close()
        windows[i] = null
      } catch (err) {
        continue;
      }
    }

    win = null
  })

  //quando ganha focus, devemos mandar para o ipcRenderer para atualizar as novas formulas
  win.on('focus', () => {
    win.webContents.send('refresh-formulas');
  })
}

//ipcMain Stuff

// fica ouvindo do dashboard-controller para ver se o cara clicou no botao de 
// nova formula ou se clicou em uma formula do dashboard pra alterar/visualizar uma formula
ipcMain.on('create-window-formula', (event, formula) => {
  // criamos uma nova janela para criar ou editar formulas
  // caso formula seja null, a propria window saberá que uma nova formula deve ser criada. 
  let newindow = new BrowserWindow({width: 1024, height: 800})

  //setamos a URL da pagina para a de formula.html
  newindow.loadFile('./pages/formula.html')

  // enviamos para o ipcRenderer da pagina aberta o codigo da formula para buscar no banco as substancias da qual eh feita
  // assim que a pagina acabou de ser carregada
  newindow.webContents.on('did-finish-load', () => {
    newindow.webContents.send('load-substances', formula, page_counter)
    page_counter++
  })

  //caso o usuario feche uma janela
  /*newindow.on('closed', () => {
    newindow = null;
  })*/

  formula_windows[page_counter.toString()] = newindow
})

ipcMain.on('close-window-formula', (event, page_id) => {
  // identificamos através do page_id passado por parametro, qual janela deve ser fechada
  let window_to_close = formula_windows[page_id.toString()];

  // fechamos a formula_window
  window_to_close.close();
  window_to_close = null;

  // tiramos a formula_window do vetor
  delete formula_windows[page_id.toString()];
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  	if (process.platform !== 'darwin') {
    	app.quit()
  	}
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  	if (win === null) {
    	createWindow()
  	}
})
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.