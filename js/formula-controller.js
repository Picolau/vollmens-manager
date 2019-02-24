let app = angular.module('dashApp', []);

app.controller('FormulaController', function($scope, $timeout) {
    /****************************************************************************************************/
    /****************************************VARIÁVEIS E FUNÇÕES AUXILIARES******************************/
    /****************************************************************************************************/
    // esse page identifier eh para controlar qual pagina eu sou para a mainjs poder me fechar depois caso clique em sair
    let page_identifier;

    //ipcRenderer inicializado para falar com o main.js em caso de clique no botao de nova formula
    //ou caso clique em alguma das tabelas
    const {ipcRenderer} = require('electron')

    const RED_COLOR = 'rgb(255,120,0)';
    const GREEN_COLOR = 'rgb(0,255,0)';
    const YELLOW_COLOR = 'rgb(255,255,0)';
    const BLUE_COLOR = 'rgb(0,100,255)'

    const FILL_ALL_DATA_MESSAGE = 'Por favor, preencha todos os dados!'
    const UNKNOWN_PRODUCT_MESSAGE = 'PRODUTO DESCONHECIDO'
    const NOT_RECOMMENDED_OR_DEPRECATED_PRODUCT_MESSAGE = 'PRODUTO NÃO RECOMENDADO OU OBSOLETO'
    const SELECT_FROM_FILTER_MESSAGE = 'POR FAVOR, SELECIONE A SUBSTANCIA APROPRIADAMENTE CLICANDO NO FILTRO DE SELEÇÃO'
    
    // para controlar quando a info message de uma substancia irá aparecer
    let info_message_interval;

    // charts A, B e C sao referentes ao tipo da substancia e o D eh referente ao capsule damage factor
    let chartA, chartB, chartC, chartD;

    // para controlar as porcentagens de cada Type de substancia
    let percentageA = 0.0, percentageB = 0.0, percentageC = 0.0;

    // todas as substancias do banco de dados da planilha
    let all_substances;

    //utils para tratar alguns casos gerais
    let util_service = require('../js/utils.js')

    // variavel por onde controlaremos se eh uma nova formula
    // se formula_id eh zero entao eh uma nova formula, se não, eh o id da formula que estamos editando
    let formula_id = 0;

    // retorna um novo objeto formula_substancia quando o cara clica em 'nova substancia'
    // nesse objeto, guardaremos TUDO o que será mostrado lá no dashboard de substancias.
    // name (description), code (code), parts, porcentagem (calculada sempre que altera), group_id (cor do grafico), action (para controle posterior)
    // a action pode ser: insert, delete, update ou nothing
    // caso o usuario delete uma substancia que veio da api, a action será delete
    // caso o usuario delete uma substancia que nao veio da api, a action será nothing
    // em formula.html, apenas mostramos as formulas_substancias para os quais a action eh insert ou update
    // alert level pode ser LIGHT, MEDIUM, STRONG (se o group_id for 5)
    // filled_all_inputs pode ser false ou true e controla (por enquanto) apenas se todos os campos foram preenchidos
    // filled_all_inputs eh usado para dar alert caso o usuario tente salvar a formula, mas tem alguma substancia com filled_all_inputs false
    // info_message eh um object que contem: 
    //   1. o vetor de objetos mensagens de texto (que contem title e content)
    //   2. boolean que diz se estah displaying ou nao  
    let new_obj_formula_substance = () => {
      return {substance_id: 0, 
              parts:'', code: '', name:'', percentage:'0.00%', group_id: 5, 
              alert_level:'strong', 
              filled_all_inputs: false,
              action: 'insert', 
              info_message: {text_message: [{title: 'MESSAGE', content: FILL_ALL_DATA_MESSAGE}], is_showing: false},
              substances_infos:[{title: '', content: ''}], 
              logp:0, 
              vapor_pressure: 0, 
              capsule_damage_factor:0, 
              is_filtering_code: false, 
              is_filtering_name: false, 
              selected_from_filter_properly: false};
    }

    // funcao para retornar uma nova formula padrão
    let new_standard_formula = () => {
      return {code:"#F", name: "", group_id: 5, total_parts: 0, 
              number_of_ingredients: 0, logp: 0, vapor_pressure: 0, capsule_damage_factor: 0};
    }

    let save_formula_and_substances = () => {
      return new Promise(function(resolve, reject) {
        // se nao eh uma formula nova
        if (formula_id) { 
          //faremos a edição desses dados no banco (TODO: observação)
          // nome, group_id, total_parts, number_of_ingredients, logp, vaporp e cdf
          // primeiro, as formulas_substances que devem ser deletadas, devem ser computadas primeiro, no banco de dados. Então, devemos colocar na ordem certa.
          let formulas_substances_sorted = [];

          for (let i = 0;i < f_controller.formula_substances;i++) {
            let obj_fs = f_controller.formulas_substances[i];
            
            if (obj_fs.action == 'delete') {
              formulas_substances_sorted.unshift(obj_fs);
            } else {
              formulas_substances_sorted.push(obj_fs);
            }
          }

          local_api.update_formula(formula_id, f_controller.obj_formula, formulas_substances_sorted).then(function () {
            resolve();
          })
        } else {
          // inserimos normalmente a nova formula no bd
          local_api.insert_new_formula(f_controller.obj_formula, f_controller.formula_substances).then(function (inserted_formula_id) {
            // se o usuario salvou pelo menos uma vez a formula, ja alteramos o formula_id para o ultimo formula_id inserido
            formula_id = inserted_formula_id;
            f_controller.obj_formula.code = local_api.key_code_from_formula_id(formula_id);
            resolve();
          });
        }
      });
    }

    // popula o array de filter substances pelo 'code' digitado
    let filter_by_code = (code) => {
      f_controller.filter_substances = []
      
      if (code != "") {
        for (let i = 0;i < all_substances.length;i++) {
          let possible_substance = all_substances[i];

          if (possible_substance.code.toUpperCase().match(code.toUpperCase()) != null) {
            f_controller.filter_substances.push(possible_substance);
          }
        }
      }
    }

    //popula o array de filter substances pelo 'name' digitado
    let filter_by_name = (name) => {
      f_controller.filter_substances = []
      
      if (name != "") {
        for (let i = 0;i < all_substances.length;i++) {
          let possible_substance = all_substances[i];
          // nesse caso, o name a que estamos se referindo eh na verdade o description da formula
          if (possible_substance.description.toUpperCase().match(name.toUpperCase()) != null) {
            f_controller.filter_substances.push(possible_substance);
          }
        }
      }
    }

    // isso aqui eh relacionado ao alert do canto esquerdo de cada substancia
    // o alert level serve para controlar a cor do alert e também para determinar a intensidade do alert
    // a info message serve para ser mostrado quando o usuario passa o mouse no icone de alert.
    let calculateAlertLevelInfoMessageAndValid = (obj_fs) => {
      // se o usuario preencheu todos os campos
      if (obj_fs.code != '' && obj_fs.name != '' && obj_fs.parts != '') {
          // filled_all_inputs eh true
          obj_fs.filled_all_inputs = true;
          obj_fs.info_message.text_message = obj_fs.substances_infos.slice();

          //casos para alert strong: unknown product ou nao selecionou apropriadamente pelo filtro
          if (obj_fs.group_id == 5) {
            obj_fs.info_message.text_message = [{title: 'MESSAGE', content:UNKNOWN_PRODUCT_MESSAGE}];
            obj_fs.alert_level = 'strong';
          } else if (!obj_fs.selected_from_filter_properly) { 
            obj_fs.info_message.text_message = [{title: 'MESSAGE', content:SELECT_FROM_FILTER_MESSAGE}];
            obj_fs.alert_level = 'strong'
          } else if (obj_fs.substances_infos.map(obj_message => obj_message.content).join().includes('NOT RECOMMENDED') ||
            obj_fs.substances_infos.join().includes('USE CODE') ||
            obj_fs.group_id == 4) { // casos para alert medium... No map ali em cima, simplesmente estamos pegando todos 
            // os objetos mensagem do substance_info e verificando se no content de cada um deles tem um NOT RECOMMENDED
            // tratamos os infos_messages e os substances_infos como arrays para tornar a quebra de linha mais fácil posteriormente
            // pelo HTML E CSS
            obj_fs.info_message.text_message = obj_fs.substances_infos.slice();
            obj_fs.info_message.text_message.unshift({title: 'MESSAGE', content:NOT_RECOMMENDED_OR_DEPRECATED_PRODUCT_MESSAGE});
            obj_fs.alert_level = 'medium';
          } else {
            obj_fs.info_message.text_message = obj_fs.substances_infos.slice();
            obj_fs.alert_level = 'light';
          }
        } else {
          obj_fs.filled_all_inputs = false;
          obj_fs.info_message.text_message = [{title: 'MESSAGE', content:FILL_ALL_DATA_MESSAGE}];
          obj_fs.alert_level = 'strong';
        }
    }

    // serve para calcular o logp, group_id, vapor_pressure, capsule_damage_factor, total_parts e number_of_ingredients
    // o os calculos para fazer update nos charts
    let calculateFormulaStuffAndChartData = () => {
      // para calculo da media ponderada do logp e vapor_pressure
      let total_parts_of_unknown_products = 0.0;
      let logp_weighted = 0.0, vapor_pressure_weighted = 0.0, capsule_damage_factor_weighted = 0.0;
      
      let total_parts_type_A = 0, total_parts_type_B = 0, total_parts_type_C = 0;

      f_controller.obj_formula.number_of_ingredients = 0;
      f_controller.obj_formula.total_parts = 0;

      for (let i = 0;i < f_controller.formula_substances.length;i++) {
        obj_fs = f_controller.formula_substances[i];

        // obviamente contabilizamos soh aquelas que serao inseridas ou editadas
        if (obj_fs.action == 'insert' || obj_fs.action == 'update') {
          // o numero total de ingredientes eh contabilizado caso filled_all_inputs e se selecionou do filtro
          // o capsule_damage_factor e total_parts tbm são contabilizado
          if (obj_fs.filled_all_inputs && obj_fs.selected_from_filter_properly) {
            let obj_parts = parseInt(obj_fs.parts);

            f_controller.obj_formula.number_of_ingredients += 1;
            f_controller.obj_formula.total_parts += obj_parts;
            capsule_damage_factor_weighted += obj_fs.capsule_damage_factor * obj_parts;


            // para as contas de logp e vapor_pressure, não sao contabilizados:
            // 1. unknown products (group_id == 5)
            // 2. substancias com os campos nao totalmente preenchidos (filled_all_inputs)
            // 3. substancias que nao foram selecionadas pela filtro de substancias apropriadamente
            if (obj_fs.group_id != 5) {
              total_parts_of_unknown_products += obj_parts;

              logp_weighted += obj_fs.logp * obj_parts;
              vapor_pressure_weighted += obj_fs.vapor_pressure * obj_parts;
            }

            if (obj_fs.group_id == 1) {
              total_parts_type_A += obj_parts;
            } else if (obj_fs.group_id == 2) {
              total_parts_type_B += obj_parts;
            } else if (obj_fs.group_id == 3) {
              total_parts_type_C += obj_parts;
            }
          }
        }
      }

      // fazendo a media ponderada dos logps, vaporps e capsule_damages da formula
      f_controller.obj_formula.logp = logp_weighted / total_parts_of_unknown_products;
      f_controller.obj_formula.vapor_pressure = vapor_pressure_weighted / total_parts_of_unknown_products;
      f_controller.obj_formula.capsule_damage_factor = capsule_damage_factor_weighted / f_controller.obj_formula.total_parts;

      let str_logp = f_controller.obj_formula.logp.toString();
      let str_vaporp = f_controller.obj_formula.vapor_pressure.toString();
      f_controller.obj_formula.group_id = util_service.groupIdByLogpAndVaporPressure(str_logp, str_vaporp);

      // para atribuir a porcentagem das substancias
      for (let i = 0;i < f_controller.formula_substances.length;i++) {
        obj_fs = f_controller.formula_substances[i];

        // obviamente contabilizamos soh aquelas que serao inseridas ou editadas
        if (obj_fs.action == 'insert' || obj_fs.action == 'update') {
          if (obj_fs.filled_all_inputs && obj_fs.selected_from_filter_properly) {
            let obj_percentage = 100 * parseFloat(obj_fs.parts) / f_controller.obj_formula.total_parts;
            obj_fs.percentage = obj_percentage.toFixed(2).toString() + '%';
          }
        }
      }

      percentageA = (100 * total_parts_type_A / f_controller.obj_formula.total_parts);
      percentageB = (100 * total_parts_type_B / f_controller.obj_formula.total_parts);
      percentageC = (100 * total_parts_type_C / f_controller.obj_formula.total_parts);

      chartA.series[0].setData([{y: percentageA, color: GREEN_COLOR}], true);
      chartB.series[0].setData([{y: percentageB, color: YELLOW_COLOR}], true);
      chartC.series[0].setData([{y: percentageC, color: RED_COLOR}], true);
      chartD.series[0].setData([{y: f_controller.obj_formula.capsule_damage_factor, color: BLUE_COLOR}], true);
    }

    let compare_by_code = (a,b) => {
      if (a.code < b.code)
        return -1;
      if (a.code > b.code)
        return 1;
      return 0;
    }

    let compare_by_name = (a,b) => {
      if (a.name < b.name)
        return -1;
      if (a.name > b.name)
        return 1;
      return 0;
    }

    let compare_by_parts = (a,b) => {
      if (parseInt(a.parts) < parseInt(b.parts))
        return -1;
      if (parseInt(a.parts) > parseInt(b.parts))
        return 1;
      return 0;
    }

    // percorre todos os formula substances e ve se algum deles nao preencheu todos os campos ou se nao selecionou 
    // a substancia corretamente
    // retorna not-all-inputs-filled ou not-all-selected-properly
    let error_that_cannot_let_save = () => {
      let all_inputs_filled = true;
      let all_selected_properly = true;

      for (let i = 0;i < f_controller.formula_substances.length;i++) {
        const obj_fs = f_controller.formula_substances[i];

        if (obj_fs.action == 'insert' || obj_fs.action == 'update') {
          if (!obj_fs.filled_all_inputs) {
            all_inputs_filled = false;
            break;
          }

          if (!obj_fs.selected_from_filter_properly) {
            all_selected_properly = false;
            break;
          }
        }
      }

      if (!all_inputs_filled) {
        return 'not-all-inputs-filled'
      } else if (!all_selected_properly) {
        return 'not-all-selected-properly'
      } else {
        return null
      }
    }

    /********************************************END AUXILIARES******************************************/
    /****************************************************************************************************/


    /****************************************************************************************************/
    /******************************************VARIÁVEIS DO ANGULAR**************************************/
    /****************************************************************************************************/

    let f_controller = this;

    // variavel para controlar o objeto novo (tanto no caso dele estar inserindo, quanto no caso dele estar editando)
    // algumas coisas sao sempre atualizadas no obj_formula (logp, vapor, capsule, group_id, warning)
    f_controller.obj_formula = null;

    // variavel que guarda objetos das substancias que estao sendo mostradas no dashboard de substancias.
    // cada objeto de substance terão os calores na funcao new_obj_formula_substance
    // TODO: sempre que for carregar uma formula já feita da api ou quando clica no botão de cancelar, 
    // devemos fazer um join em formula_substances para ter um objeto como o objeto acima.
    // assim que o cara for salvar, faremos conforme a action e sempre verificandoa filled_all_inputsade
    f_controller.formula_substances = [];

    //populamos o array de all substances e inicializamos a variavel para filtros de substances
    f_controller.filter_substances = [];

    // controla se salvou tudo
    // o saved_everything vira false se: 1- alterou o nome da formula; 
    // 2- alterou o code, o name ou as parts de alguma substancia
    // 3- inseriu uma nova substancia
    // 4- deletou uma nova substancia
    f_controller.saved_everything = true;

    /******************************************END VARIÁVEIS ANGULAR*************************************/
    /****************************************************************************************************/

    /****************************************************************************************************/
    /******************************************REQUISIÇÕES API LOCAL*************************************/
    /****************************************************************************************************/

    //variavel para acesso a local-api e o banco de dados
    let local_api = require('../server/local-api.js');

    // todas as substancias carregadas da api-local
    local_api.select_all_substances().then((result) => {
      all_substances = result;
      console.log(all_substances);
    });

    // funcao para inicializar o objeto formula
    let init_obj_formula_from_api = () => {
      local_api.select_formula_by_id(formula_id).then((formula) => {
        //quer dizer que encontrou alguma formula, ou seja, nao eh uma nova formula
        if (formula) {
          f_controller.obj_formula = formula;

          // tranforma um id para o formato #F0001 para ser mostrado la no dashboard utilizando a variavel formula_id acima
          f_controller.obj_formula.code = '#' + util_service.key_code_from_formula_id(formula_id);

          // carrega todas as substancias da formula e faz os ajustes necessários
          local_api.select_all_formula_substances(formula_id).then(function (api_formula_substances) {
            console.log(api_formula_substances);

            f_controller.formula_substances = [];

            // atribuimos todos os formulas_substances que vieram do banco de dados para o formula_substances do f_controller
            for (let i=0;i < api_formula_substances.length;i++) {
              let obj_fs = new_obj_formula_substance();

              // simulamos que o cara selecionou a substancia da api de
              f_controller.on_select_substance(api_formula_substances[i], obj_fs)

              // simulamos que o usuario digitou corretamente as parts
              obj_fs.parts = api_formula_substances[i].parts.toString();

              // setamos a ação para 'update'
              obj_fs.action = 'update';

              // a chamada para essa function eh apenas para calcular o info_message basicamente
              calculateAlertLevelInfoMessageAndValid(obj_fs);

              f_controller.formula_substances.push(obj_fs);
            }

            calculateFormulaStuffAndChartData();
            $scope.$apply();
          });
        } else { // eh uma nova formula pois a api_local enviou undefined, ou seja, o formula_id = 0 já que nao achou nenhuma formula_id
          f_controller.obj_formula = new_standard_formula();
          f_controller.obj_formula.code = '#F';
          f_controller.formula_substances = [];
        }

        calculateFormulaStuffAndChartData();
        $scope.$apply();
      });
    }

    /***********************************************END API LOCAL****************************************/
    /****************************************************************************************************/

    /****************************************************************************************************/
    /*********************FUNCOES DO ANGULAR CASO CLIQUE OU FAÇA ALGUMA AÇÃO*****************************/
    /****************************************************************************************************/

    //funcao para salvar e chamar para salvar os outros trecos do BD
    f_controller.save_changes = () => {
      /**********NAO SERÁ POSSIVEL SALVAR UMA FORMULA CASO ALGUM DESSES CASOS ABAIXO OCORRA:**********/

      // primeiro caso: o usuario nao deu nome à substancia
      if (f_controller.obj_formula.name == '') {
        alert('Dê um nome para sua fórmula!')

      } else {
        const error = error_that_cannot_let_save();

        // segundo caso: o usuario nao preencheu todos os campos de alguma substancia
        if (error == 'not-all-inputs-filled') {
          alert('Preencha todos os campos (codigo, nome e parts) corretamente para todas as substancias!' + 
          '\nProcure resolver onde os alertas estão vermelhos')

          //terceiro caso: o usuario nao clicou no filtro da caixa de seleção
        } else if (error == 'not-all-selected-properly') {
          alert('Selecione apropriadamente da caixa de seleção para todas as substancias' + 
          '\nProcure resolver onde os alertas estão vermelhos')
        } else if (!error) {
          alert('Salvo com sucesso!')
          f_controller.saved_everything = true;

          save_formula_and_substances().then(function() {
            for (let i = 0;i < f_controller.formula_substances.length;i++) {
              const obj_fs = f_controller.formula_substances[i]

              if (obj_fs.action == 'delete' || obj_fs.action == 'nothing') {
                f_controller.formula_substances.splice(i, 1);
              } else {
                obj_fs.action = 'update';
              }
            }

            $scope.$apply();
          });
        }
        
      }
    }

    //funcao para cancelar alteraçoes nao salvas
    f_controller.cancel_changes = () => {
      if (!f_controller.saved_everything) {
        // basicamente pegamos todos os objetos da API quando ele cancela alterações para uma formula
        if (confirm('Tem certeza que deseja cancelar as alterações não salvas?')) {
          f_controller.saved_everything = true;
          init_obj_formula_from_api();
        }
      }
    }

    //funcao para sair
    f_controller.exit = () => {
      if (f_controller.saved_everything) {
        /**********CASOS QUE VALE A PENA AVISAR O USUARIO ANTES DE SAIR:**********/
        
        //primeiro caso: group_id total da substancia eh 4 (logp < 2) ou capsule damage excedeu 1.6
        if (f_controller.obj_formula.group_id == 4 || 
          f_controller.obj_formula.capsule_damage_factor > util_service.recommended_range_percentages().capsule_damage.max) {
          if (confirm('ATENÇÃO!\nAs propriedades químicas totais de sua fórmula podem danificar as cápsulas\n' + 
            '\nRecomenda-se que o gráfico de "capsule damage power" esteja dentro da faixa pintada e que não' + 
            'haja muitos alertas amarelos ou produtos desconhecidos\nDeseja continuar mesmo assim?')) {
            ipcRenderer.send('close-window-formula', page_identifier);
          }
        
        // segundo caso: TypeA fora de range
        } else if (percentageA < util_service.recommended_range_percentages().typeA.min ||
          percentageA > util_service.recommended_range_percentages().typeA.max) {
          if (confirm('ATENÇÃO!\nRecomenda-se que o gráfico referente às substâncias do tipo A estejam dentro da faixa pintada' 
            + '\nDeseja continuar mesmo assim?')) {
            ipcRenderer.send('close-window-formula', page_identifier);
          }

        // terceiro caso: TypeB fora de range
        } else if (percentageB < util_service.recommended_range_percentages().typeB.min ||
          percentageB > util_service.recommended_range_percentages().typeB.max) {
          if (confirm('ATENÇÃO!\nRecomenda-se que o gráfico referente às substâncias do tipo B estejam dentro da faixa pintada' 
            + '\nDeseja continuar mesmo assim?')) {
            ipcRenderer.send('close-window-formula', page_identifier);
          }

        // terceiro caso: TypeC fora de range
        } else if (percentageC < util_service.recommended_range_percentages().typeC.min ||
          percentageC > util_service.recommended_range_percentages().typeC.max) {
          if (confirm('ATENÇÃO!\nRecomenda-se que o gráfico referente às substâncias do tipo C estejam dentro da faixa pintada' 
            + '\nDeseja continuar mesmo assim?')) {
            ipcRenderer.send('close-window-formula', page_identifier);
          }

        } else {
          ipcRenderer.send('close-window-formula', page_identifier);
        }
      } else {
        if(confirm('Tem certeza de que deseja sair? \nVocê tem alterações não salvas!')){
          console.log(page_identifier);
          ipcRenderer.send('close-window-formula', page_identifier);
        }
      }
    }

    //funcao caso clique no '+' para adicionar uma substancia à formula
    f_controller.new_formula_substance = () => {
      //simplesmente dá unsfhit em uma nova formula_substance
      //f_controller.formula_substances.unshift(new_obj_formula_substance());
      f_controller.formula_substances.push(new_obj_formula_substance());
      f_controller.saved_everything = false;
      $timeout(function() {
        $('.tbl-content').scrollTop($('.tbl-content')[0].scrollHeight+500);
      }, 1)
    }

    // funcao para controlar que a formula_substance perdeu foco (seja em code, name ou parts)
    // what_blurred pode ser 'code' / 'name' / 'parts'
    f_controller.on_blur_formula_substance = (obj_formula_substance, what_blurred) => {
      // esse timout eh necessário para o caso qdo o usuario seleciona a substancia no li
      // se nao tiver esse timeout, os li's somem antes de chamar a funcao de ng-click
      setTimeout(() => {
        // chamamos isso independente do blur que deu
        calculateAlertLevelInfoMessageAndValid(obj_formula_substance);

        if (what_blurred == 'parts') {
          calculateFormulaStuffAndChartData(obj_formula_substance);
        } else {
          if (obj_formula_substance.parts != '') { // ja preencheu as parts antes de preencher o code e o name
            // a funcao de calculate acima eh chamada de novo, pois quando foi chamada pela primeira vez, 
            // nao foi contabilizada pois code e name eram variaveis ainda naoa atribuidas
            calculateFormulaStuffAndChartData(obj_formula_substance);
          } else {
            // TODO: focar direto pro input de 'parts'; mas fica pra depois
          }

          //setamos os filtering para false para sumir a lista quando deu on blur
          if (what_blurred == 'code') {
            obj_formula_substance.is_filtering_code = false;
          } else if (what_blurred == 'name') {
            obj_formula_substance.is_filtering_name = false;
          }
        }

        $scope.$apply();
      }, 300);
    }

    // funcao que atribui tudo de uma substancia para a formula_substance que ele clicou lá no filtro
    f_controller.on_select_substance = function (selected_substance, obj_formula_substance) {
      obj_formula_substance.name = selected_substance.description;
      obj_formula_substance.code = selected_substance.code;
      obj_formula_substance.substance_id = selected_substance.substance_id;
      obj_formula_substance.group_id = selected_substance.group_id;
      obj_formula_substance.logp = parseFloat(selected_substance.logp);
      obj_formula_substance.vapor_pressure = parseFloat(selected_substance.vapor_pressure);
      obj_formula_substance.capsule_damage_factor = selected_substance.capsule_damage_factor == '' ? 0.0 : parseFloat(selected_substance.capsule_damage_factor);
      obj_formula_substance.substances_infos = [
        {title: 'WARNING',content: selected_substance.warning == '' ? 'no warnings' : selected_substance.warning},
        {title: 'WARNING OBS', content: selected_substance.warning_obs == '' ? 'no warning observations' : selected_substance.warning_obs},
        {title: 'CAS', content: selected_substance.cas}
      ];
      obj_formula_substance.selected_from_filter_properly = true;
    }

    //quando o usuario digita alguma coisa la nos campos de edição do dashboard de formulas_substances
    f_controller.on_change_formula_substance = (obj_formula_substance, what_changed) => {
      if (what_changed == 'code') {
        filter_by_code(obj_formula_substance.code);
      } else if (what_changed == 'name') {
        filter_by_name(obj_formula_substance.name);
      } else if (what_changed == 'parts') {
        // remove todos os chars que nao sao numeros de 'parts'
        obj_formula_substance.parts = obj_formula_substance.parts.replace(/\D/g, '')
      }

      f_controller.saved_everything = false;
    }

    // quando os text inputs ganham focus
    // esse controler por 'is_filtering' é importante para cada objeto de formula_substance para que as possible_substances
    // nao apareçam em baixo de todos os text_inputs
    f_controller.on_focus_formula_substance = (obj_formula_substance, what_focused) => {
      // setamos o selected_from_filter_properly para false quando ele dá focus em alguns dos inputs (code ou name)
      // o selected_from_filter soh será mudado para true quando ele realmente seleciona alguma substancia
      if (what_focused == 'code') {
        obj_formula_substance.is_filtering_code = true;
        obj_formula_substance.selected_from_filter_properly = false;
        filter_by_code(obj_formula_substance.code);
      } else if (what_focused == 'name') {
        obj_formula_substance.is_filtering_name = true;
        obj_formula_substance.selected_from_filter_properly = false;
        filter_by_name(obj_formula_substance.name);
      }
    }

    // caso o usuario fica com o mouse em cima do alert (espera 500ms para mostrar a mensagem)
    f_controller.show_info_message_delay = (obj_formula_substance) => {
      clearInterval(info_message_interval);

      info_message_interval = setInterval(() => {
        obj_formula_substance.info_message.is_showing = true;
        $scope.$apply();
      }, 500);
    }
    
    f_controller.show_info_message = (obj_formula_substance) => {
      clearInterval(info_message_interval);
      
      obj_formula_substance.info_message.is_showing = true;
    }

    // esconde a info message caso o alert perca o foco do mouse
    f_controller.hide_info_message_delay = (obj_formula_substance) => {
      clearInterval(info_message_interval);
      
      info_message_interval = setInterval(() => {
        obj_formula_substance.info_message.is_showing = false;
        $scope.$apply();
      }, 100);
    }
    
    f_controller.hide_info_message = (obj_formula_substance) => {
      clearInterval(info_message_interval);
      obj_formula_substance.info_message.is_showing = false;
    }

    // caso o usuario pressione enter quando digitar o numero de parts
    f_controller.on_pressed_key = ($event, obj_formula_substance) => {
      var keyCode = $event.which || $event.keyCode;
      // apertou enter, então força o blur do text input
      if (keyCode === 13) {
          console.log('apertou enter')
          $event.target.blur();
      }
    }

    // caso o usuario clique no 'X' lá no dashboard de substancia
    f_controller.remove_formula_substance = (obj_formula_substance) => {
      if (obj_formula_substance.action == 'insert') {
        obj_formula_substance.action = 'nothing'
      } else if (obj_formula_substance.action == 'update'){
        obj_formula_substance.action = 'delete'
      }

      f_controller.saved_everything = false;

      // atualizamos os stuffs
      calculateFormulaStuffAndChartData();
    }

    // para ordenar por code, name ou parts, no dashboard
    f_controller.sort_formula_substances = (sort_by_what) => {
      if (sort_by_what == 'code') {
        f_controller.formula_substances.sort(compare_by_code)
      } else if (sort_by_what == 'name') {
        f_controller.formula_substances.sort(compare_by_name)
      } else if (sort_by_what == 'parts') {
        f_controller.formula_substances.sort(compare_by_parts)
      }
    }

    /*****************************************END MAIN.JS LISTENER***************************************/
    /****************************************************************************************************/

    /****************************************************************************************************/
    /*********************************************MAIN.JS LISTENER***************************************/
    /****************************************************************************************************/

    ipcRenderer.on('load-substances', (event, formula, page_id) => {
      // se formula nao for nulo atribuímos o valor de formula_id a ele, se não, ele vale zero para indicar que eh uma nova formula
      if (formula)
        formula_id = formula.formula_id;
      else 
        formula_id = 0;

      // atribuição do identificador da pagina
      page_identifier = page_id;
      
      init_obj_formula_from_api();
    });

    /*****************************************END MAIN.JS LISTENER***************************************/
    /****************************************************************************************************/


    /****************************************************************************************************/
    /***********************************************CHARTS***********************************************/
    /****************************************************************************************************/
    
    //inicializa os charts com essa funcao
    let init_charts = () => {
      var Highcharts = require('highcharts');

      let ranges = util_service.recommended_range_percentages();

      // Load module after Highcharts is loaded
      require('highcharts/modules/exporting')(Highcharts);

      Highcharts.setOptions({
        title: null,
        exporting: { enabled: false },
        chart: {
          type: 'column',
          backgroundColor:'rgba(255, 255, 255, 0.0)',
          style: {"fontFamily": "\"Maven Pro Bold\", sans-serif","fontSize":"15px"}
        },
        legend: {
          enabled: false
        },
        credits: {
          enabled: false
        }
      });

      chartA = Highcharts.chart('containerA', {
          xAxis: {
              categories: ['Type A'],
              labels : {
                  style: {"color": "#fff", "fontSize": "15px"}
              }
          },
          yAxis: {
              gridLineWidth: 1,
              gridLineColor: 'rgba(255,255,255,0.8)',
              max: 100,
              plotBands: [{ // vai pintar de transparente de 0 até min
                  from: 0,
                  to: ranges.typeA.min,
                  color: 'rgba(255,255,255, 0)'
              }, { // vai pintar com a devida cor de min até max
                  from: ranges.typeA.min,
                  to: ranges.typeA.max,
                  color: 'rgba(0,255,0,0.5)'
              }, {// por fim, vai pintar de transparente novamente de max até 100
                  from: ranges.typeA.max,
                  to: 100,
                  color: 'rgba(255,255,255, 0)'
              }],
              title: {
                  text: 'Total parts (%)',
                  style: {"color": "#fff", "fontSize": "25px"}
              },
              labels: {
                  style: {"color": "#fff", "fontSize": "15px"},

                  formatter: function () {
                      return this.value + ' %';
                  }
              }
          },
          series: [{
              data: [{
                y: 0,
                color: GREEN_COLOR
              }]
          }]
      });

      chartB = Highcharts.chart('containerB', {
          xAxis: {
              categories: ['Type B'],
              labels : {
                  style: {"color": "#fff", "fontSize": "15px"}
              }
          },
          yAxis: {
              gridLineWidth: 1,
              gridLineColor: 'rgba(255,255,255,0.8)',
              max: 100,
              plotBands: [{ // vai pintar de transparente de 0 até min
                  from: 0,
                  to: ranges.typeB.min,
                  color: 'rgba(255,255,255, 0)'
              }, { // vai pintar com a devida cor de min até max
                  from: ranges.typeB.min,
                  to: ranges.typeB.max,
                  color: 'rgba(255,255,0,0.5)'
              }, {// por fim, vai pintar de transparente novamente de max até 100
                  from: ranges.typeB.max,
                  to: 100,
                  color: 'rgba(255,255,255, 0)'
              }],
              title: {
                  text: null,
                  style: {"color": "#fff", "fontSize": "25px"}
              },
              labels: {
                  style: {"color": "#fff", "fontSize": "15px"},

                  formatter: function () {
                      return this.value + ' %';
                  }
              }
          },
          series: [{
              data: [{
                y: 0,
                color: YELLOW_COLOR
              }]
          }]
      });

      chartC = Highcharts.chart('containerC', {
          xAxis: {
              categories: ['Type C'],
              labels : {
                  style: {"color": "#fff", "fontSize": "15px"}
              }
          },
          yAxis: {
              gridLineWidth: 1,
              gridLineColor: 'rgba(255,255,255,0.8)',
              max: 100,
              plotBands: [{ // vai pintar de transparente de 0 até min
                  from: 0,
                  to: ranges.typeC.min,
                  color: 'rgba(255,255,255, 0)'
              }, { // vai pintar com a devida cor de min até max
                  from: ranges.typeC.min,
                  to: ranges.typeC.max,
                  color: 'rgba(255,120,0,0.5)'
              }, {// por fim, vai pintar de transparente novamente de max até 100
                  from: ranges.typeC.max,
                  to: 100,
                  color: 'rgba(255,255,255, 0)'
              }],
              title: {
                  text: null,
                  style: {"color": "#fff", "fontSize": "25px"}
              },
              labels: {
                  style: {"color": "#fff", "fontSize": "15px"},

                  formatter: function () {
                      return this.value + ' %';
                  }
              }
          },
          series: [{
              data: [{
                  y: 0,
                  color: RED_COLOR
              }]
          }]
      });

      chartD = Highcharts.chart('containerD', {
          xAxis: {
              categories: ['Capsule Damage Power'],
              labels : {
                  style: {"color": "#fff", "fontSize": "15px"}
              }
          },
          yAxis: {
              gridLineWidth: 1,
              gridLineColor: 'rgba(255,255,255,0.8)',
              max: 2,
              plotBands: [{
                  from: 0,
                  to: ranges.capsule_damage.min,
                  color: 'rgba(255,255,255, 0)'
              }, {
                  from: ranges.capsule_damage.min,
                  to: ranges.capsule_damage.med,
                  color: 'rgba(0,100,255,0.5)'
              }, {
                  from: ranges.capsule_damage.med,
                  to: ranges.capsule_damage.max,
                  color: 'rgba(0,100,255,0.2)'
              }, {
                  from: ranges.capsule_damage.max,
                  to: 2,
                  color: 'rgba(255,255,255,0)'
              }],
              title: {
                  text: null,
                  style: {"color": "#fff", "fontSize": "25px"}
              },
              labels: {
                  style: {"color": "#fff", "fontSize": "15px"},

                  formatter: function () {
                      return this.value + ' cdp';
                  }
              }
          },
          series: [{
              data: [{
                  y: 0,
                  color: BLUE_COLOR
              }]
          }]
      });
    }

    //inicializa-se os charts:
    init_charts();

    /************************************************END CHARTS******************************************/
    /****************************************************************************************************/
  });