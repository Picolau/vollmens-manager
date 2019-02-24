angular.module('dashApp', [])
  .controller('DashboardController', function($scope) {
    let dashboard = this;

    //variavel para acesso a local-api
    let local_api = require('../server/local-api.js')

    //inicializamos o utils
    let util_service = require('../js/utils.js')

    //ipcRenderer inicializado para falar com o main.js em caso de clique no botao de nova formula
    //ou caso clique em alguma das tabelas
    const {ipcRenderer} = require('electron')

    // array utilizado aplicar filtro com regex e popular a filtered_created_formulas
    // soh eh alterada em caso de remocao e insercao/update
    dashboard.created_formulas = [];

    // vetor utilizado na pagina dashboard e para todo o resto praticamente
    dashboard.filtered_created_formulas = [];

    //variavel para guardar o input do codigo da formula caso o usuario queira filtrar por codigo
    dashboard.code_input = '';

    //variavel para guardar o input do nome da formula caso o usuario queira filtrar por nome
    dashboard.formula_name_input = '';

    let findIndexByFormulaId = function (formulas_list, formula_id) {
      let index = -1; 

      for (let i = 0;i < formulas_list.length && index == -1;i++) {
        if (formulas_list[i].formula_id == formula_id) 
          index = i;
      }

      return index;
    }

    let init_formulas = () => {
      //inicializa o dashboard com as formulas ja criadas ateh agora
      local_api.select_all_formulas().then(function (rows) {
        console.log(rows);
        
        // esse for eh para adicionar leading '0's na frente do formula_id e criar o 'CODE' das formulas
        for (let i = 0;i<rows.length;i++) {

          //adicionamos no objeto formula
          rows[i].code = util_service.key_code_from_formula_id(rows[i].formula_id);
          rows[i].logp = rows[i].logp.toFixed(2);
          rows[i].vapor_pressure = rows[i].vapor_pressure.toFixed(2);
        }

        dashboard.created_formulas = rows;

        //o slice cria uma copia do array created_formulas basicamente
        dashboard.filtered_created_formulas = dashboard.created_formulas.slice();

        $scope.$apply();
      });
    }

    init_formulas();
  
    //funcao para remover a formula TODO: precisa colocar um alert nisso de 'tem certeza'
    dashboard.remove_formula = function (formula) {
      if (confirm("Tem certeza de que deseja remover essa fórmula permanentemente?")) {
        //aqui estamos removendo primeiro do filtered.
        //achamos o index no vetor de formulas para remover a formula passada pelo dashboard.html pelo angular
        let index = findIndexByFormulaId(dashboard.filtered_created_formulas, formula.formula_id);

        //removemos a formula do vetor para rapida atualizacao
        dashboard.filtered_created_formulas.splice(index, 1);

        // agora precisamos remover do created_formulas, 
        // ja que os objetos nao sao iguais
        index = findIndexByFormulaId(dashboard.created_formulas, formula.formula_id);
        dashboard.created_formulas.splice(index, 1);
        
        //removemos do banco de dados
        local_api.delete_formula(formula.formula_id);
      }
    }

    //filtra (pelos inputs digitados de codigo e nome-de-formula) os created_formula e popula o filtered_created_formulas
    dashboard.filter_inputs = function () {
      let filtered_created_formulas_by_code = [];
      let new_filtered_created_formulas = [];

      //filtramos primeiramente os codigos
      for (let i = 0; i < dashboard.created_formulas.length; i++) {
        let formula = dashboard.created_formulas[i];

        if (dashboard.code_input != '') {
          if (formula.code.toUpperCase().match(dashboard.code_input.toUpperCase()) != null) {
            // a formula se encaixa na pesquisa:
            filtered_created_formulas_by_code.push(formula);
          }
        } else {
          filtered_created_formulas_by_code.push(formula);
        }
      }

      //depois filtramos por nome
      for (let i = 0; i < filtered_created_formulas_by_code.length; i++) {
        let formula = filtered_created_formulas_by_code[i];

        if (dashboard.formula_name_input != '') {
          if (formula.formula_name.toUpperCase().match(dashboard.formula_name_input.toUpperCase()) != null) {
            // a formula se encaixa na pesquisa:
            new_filtered_created_formulas.push(formula);
          }
        } else {
          new_filtered_created_formulas.push(formula);
        }
      }

      dashboard.filtered_created_formulas = new_filtered_created_formulas;
    }

    //funcao que escuta se clicou no botao de nova formula
    dashboard.new_formula = function () {
      // mandamos um sinal para a ipcMain da main.js com o parametro null.
      // a main ira identificar que ele eh nulo e portanto saberá que uma nova formula deve ser criada
      ipcRenderer.send('create-window-formula', null);
    }

    //funcao que escuta caso o usuario tenha clicado em alguma formula do dashboard para visualização/edição
    dashboard.view_formula = function (formula) {
      // mandamos um sinal para a ipcMain da main.js com o objeto da formula clicada
      // a main ira identificar que ele nao eh nulo e portanto sabera que uma formula quer ser visualizada ou editada
      ipcRenderer.send('create-window-formula', formula);
    }

    //eh chamado quando a pagina de formulas ganha focus.
    ipcRenderer.on('refresh-formulas', (event) => {
      setTimeout(function() { 
        init_formulas(); 
      }, 500);

      console.log("deu refresh");
    });

  });