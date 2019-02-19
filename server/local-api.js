//path para formulas
const database_path = './formulas.db3'

// inicializamos a instancia do sqlite3 aqui
let sqlite3 = require('sqlite3')

let util_service = require('../js/utils.js')

//para cada funcao, devemos inicializar o db dando new ... e depois dar close

//aqui nesse caso, essa funcao ira inserir na tabela substances uma substancia que também eh uma formula apenas
// e além disso retorna o ultimo id inserido. Esse ultimo id inserido será utilizado para vincular com o 
//my_substance_id da formula que eh posteriormente inserida tbm
let insert_substance = function (obj_substance) {
  return new Promise(function (resolve, reject) {
    let db = new sqlite3.Database(database_path)

    db.run('INSERT INTO substances (code, group_id, description, sped, capsule_damage_factor, vapor_pressure, logp) VALUES ' + 
      '($code, $group_id, $description, $sped, $capsule_damage_factor, $vapor_pressure, $logp)', obj_substance, 
      function (err) {
        if (err) {
          alert(err);
          console.log(err);
          reject();
        } else {
          resolve(this.lastID);
        }
      }
    );

    db.close();
  })
}

//inserir formula e retorna o ultimo id inserido justamente para alterar o codigo da substancia para o estilo de F00xyz
let insert_formula = function (obj_formula) {
  return new Promise(function (resolve, reject) {
    let db = new sqlite3.Database(database_path)

    db.run('INSERT INTO formulas ' +
      '(my_substance_id, group_id, name, total_parts, number_of_ingredients, logp, vapor_pressure, capsule_damage_factor) VALUES ' +
      '($my_substance_id,$group_id,$name,$total_parts,$number_of_ingredients,$logp,$vapor_pressure,$capsule_damage_factor)', 
      obj_formula, 
      function (err) {
        if (err) {
          alert(err);
          console.log(err);
          reject();
        } else {
          resolve(this.lastID);
        }
      }
    );

    db.close();
  })
}

//retorna para o dashboard controller as rows pra pegar as formulas
exports.select_all_formulas = function () {
  return new Promise (function (resolve, reject) {
    //inicializacao do db com o path
    let db = new sqlite3.Database(database_path)

    //inner join com groups, pois na tabela de formulas soh guardamos o id_group e precisamos do name para dar display no dashboard
    db.all('SELECT formulas.*, formulas.name AS formula_name, groups.name AS group_name ' 
      + 'FROM formulas INNER JOIN groups ON groups.group_id = formulas.group_id;', function(err, rows) {
      if (err) {
        console.log(err);
        alert(err);
      } else {
        resolve(rows);
      }
    });

    db.close();
  });
}

//retorna undefined se nao encontrar nada, e retorna um formula pelO id se encontrou algo 
exports.select_formula_by_id = function (formula_id) {
  return new Promise(function (resolve, reject) {
    //inicializacao do db com o path
    let db = new sqlite3.Database(database_path);

    //select de todas as substances
    db.get('SELECT * FROM formulas WHERE formula_id = ?', formula_id, function(err, row) {
      resolve(row);
    });

    db.close();
  });
}

exports.select_all_formula_substances = function (formula_id) {
  return new Promise(function (resolve, reject) {
    //inicializacao do db com o path
    let db = new sqlite3.Database(database_path);

    //select de todas as substances
    db.all('SELECT * FROM formula_substance INNER JOIN substances ON ' + 
      'formula_substance.substance_id = substances.substance_id WHERE formula_id = ' + formula_id + ';', function(err, rows) {
        if (err) {
          alert(err);
        } else {
          resolve(rows);
        }
    });

    db.close();
  });
}

// retona todas as substancias para criar uma determinada formula
exports.select_all_substances = function () {
  return new Promise(function (resolve, reject) {
    //inicializacao do db com o path
    let db = new sqlite3.Database(database_path);

    //select de todas as substances
    db.all('SELECT * FROM substances', function(err, rows) {
      resolve(rows);
    });

    db.close();
  });
}
// da update na formula (name, number of ing, total_parts, etc.)
exports.update_formula = function (formula_id, obj_formula, formula_substances) {
  return new Promise(function (resolve, reject) {
    //inicializacao do db com o path
    let db = new sqlite3.Database(database_path);

    const $obj_formula = {
      $formula_id: formula_id,
      $group_id: obj_formula.group_id,
      $name: obj_formula.name,
      $total_parts: obj_formula.total_parts,
      $number_of_ingredients: obj_formula.number_of_ingredients,
      $logp: obj_formula.logp,
      $vapor_pressure: obj_formula.vapor_pressure,
      $capsule_damage_factor: obj_formula.capsule_damage_factor
    }

    db.serialize(function () {
      // update da formula (tabela em si)
      db.run('UPDATE formulas SET group_id = $group_id, name = $name, total_parts = $total_parts, ' + 
      'number_of_ingredients = $number_of_ingredients, logp = $logp, vapor_pressure = $vapor_pressure, ' + 
      'capsule_damage_factor = $capsule_damage_factor WHERE formula_id = $formula_id', $obj_formula, 
        function (err) {
          if (err) {
            alert(err);
          } else {
            //alert('updatou a formula caraio');
          }
        }
      );

      // update dos dos formula_substances
      for (let i = 0;i < formula_substances.length;i++) {
        let obj_fs = formula_substances[i];

        const $obj_fs = {$formula_id: formula_id, $substance_id: obj_fs.substance_id, $parts: obj_fs.parts};

        if (obj_fs.action == 'insert') {
          db.run('INSERT INTO formula_substance VALUES ($formula_id, $substance_id, $parts)', $obj_fs, 
            function (err) {
              if (err) {
                alert(err);
                console.log(err);
              } else {
                //alert('inseriu formula_substance: ' + this.lastID)
              }
            }
          );
        } else if (obj_fs.action == 'update') {
          db.run('UPDATE formula_substance SET parts = $parts WHERE formula_id = $formula_id AND substance_id = $substance_id', $obj_fs, 
            function (err) {
              if (err) {
                alert(err);
                console.log(err);
              } else {
                //alert('updatou formula_substance: ' + this.changes)
              }
            }
          );
        } else if (obj_fs.action == 'delete') {
          delete $obj_fs.$parts;

          db.run('DELETE FROM formula_substance WHERE formula_id = $formula_id AND substance_id = $substance_id;', $obj_fs, 
            function (err) {
              if (err) {
                alert(err);
                console.log(err);
              } else {
                //alert('deletou formula_substance: ' + this.changes)
              }
            }
          );
        }
      }

      resolve();
    });

    db.close();
  });
}

// insere uma formula apropriadamente no banco de dados. Inserindo primeiro na tabela substances e fazendo os negocios necessários
exports.insert_new_formula = function (obj_formula, formula_substances) {
  return new Promise(function (resolve, reject) {
    // surge um problema aqui, pois o obj_formula nao tem code ainda.
    let obj_substance = {
      $code: obj_formula.code, // no caso de uma formula nova, o code ainda eh #F
      $group_id: obj_formula.group_id,
      $description: obj_formula.name,
      $sped: "Fórmula",
      $capsule_damage_factor: obj_formula.capsule_damage_factor,
      $vapor_pressure: obj_formula.vapor_pressure,
      $logp: obj_formula.logp
    };

    //inserimos a formula na tabela de substancia como se fosse uma substancia msm
    insert_substance(obj_substance).then((last_substance_id) => {
      //objeto de formula ajustado para o padrão do sqlite (questoes de facilidade apenas)
      let $obj_formula = {
        $my_substance_id: last_substance_id,
        $group_id: obj_formula.group_id,
        $name: obj_formula.name.toUpperCase(),
        $total_parts: obj_formula.total_parts,
        $number_of_ingredients: obj_formula.number_of_ingredients,
        $logp: obj_formula.logp,
        $vapor_pressure: obj_formula.vapor_pressure,
        $capsule_damage_factor: obj_formula.capsule_damage_factor
      };

      //inserimos na formula e atribuimos o substance_id da substancia (que representa a formula) para o my_substance_id da formula
      insert_formula($obj_formula).then((last_formula_id) => {
        let code_to_update = util_service.key_code_from_formula_id(last_formula_id);
        let db = new sqlite3.Database(database_path)

        db.serialize(function () {
          //alteramos o codigo da substancia (que representa a formula)
          db.run("UPDATE substances SET code = ? WHERE substance_id = ?", code_to_update, last_substance_id, 
            function (err) {
              if (err) {
                console.log(err);
                alert(err);
              } else {
                console.log(this.changes);
              }
            }
          );

          // update dos formula_substances
          for (let i = 0;i < formula_substances.length;i++) {
            let obj_fs = formula_substances[i];

            console.log(obj_fs);

            const $obj_fs = {$formula_id: last_formula_id, $substance_id: obj_fs.substance_id, $parts: obj_fs.parts};

            if (obj_fs.action == 'insert') {
              db.run('INSERT INTO formula_substance VALUES ($formula_id, $substance_id, $parts)', $obj_fs, 
                function (err) {
                  if (err) {
                    alert(err);
                    console.log(err);
                  } else {
                    //alert('inseriu formula_substance: ' + this.lastID)
                  }
                }
              );
            } else if (obj_fs.action == 'update') {
              db.run('UPDATE formula_substance SET parts = $parts WHERE formula_id = $formula_id AND substance_id = $substance_id', $obj_fs, 
                function (err) {
                  if (err) {
                    alert(err);
                    console.log(err);
                  } else {
                    //alert('updatou formula_substance: ' + this.changes)
                  }
                }
              );
            } else if (obj_fs.action == 'delete') {
              db.run('DELETE FROM formula_substance WHERE formula_id = $formula_id AND substance_id = $substance_id', $obj_fs, 
                function (err) {
                  if (err) {
                    alert(err);
                    console.log(err);
                  } else {
                    //alert('deletou formula_substance: ' + this.changes)
                  }
                }
              );
            }
          }

          // retornamos a formula_id da formula inserida para que seja usada pelo formula_controller.
          resolve(last_formula_id);
          console.log('retornou a last_formula_id')
        });

        db.close();
      });
    });
  });
}

//remove uma formula caso o usuario clique no botao para remover no dashboard
//eh passado o code da formula como id de remocao
exports.delete_formula = function (formula_id) {  
  let db = new sqlite3.Database(database_path);

  db.run('PRAGMA foreign_keys=ON');

  //inner join com groups, pois na tabela de formulas soh guardamos o id_group e precisamos do name para dar display no dashboard
  db.get('SELECT * FROM formulas WHERE formula_id = ?', formula_id, function (err, row) {
    let substance_id = row.my_substance_id;
    console.log(substance_id);
    db.run('DELETE FROM formulas WHERE formula_id = ?', formula_id);
    db.run('DELETE FROM substances WHERE substance_id = ?', substance_id);
  });

  db.close();
}

//cria todas as tabelas se eh a primeira vez que o cara esta abrindo o sistema
//popula as tabelas com alguns dados para testes
//TODO talvez dps seja essa a funcao que vai ler tudo do Excel futuramente
exports.init_db = function () {
  // incializacao do db com o path
  let db = new sqlite3.Database(database_path)

  db.serialize(function () {
    //criacao da tabela de groups (ela vai ser a tabela de Type na verdade pra substituir o termo classe 1,2,3...)
    //vai ser type A, B, C
    db.run('CREATE TABLE IF NOT EXISTS groups ('+
    'group_id INTEGER PRIMARY KEY, ' +
    'name VARCHAR(15) NOT NULL);');

    // criacao da tabela de substancias, colocamos tudo varchar mas pra fazer as contas precisaremos fazer as devidas conversões
    // o motivo de colocar tudo varchar eh pq usamos uma API que vai fazer a conversao do excel para JSON e essa 
    // conversao traz tudo em string. Entao a ideia eh armazenar tudo como varchar msm e depois tratar qdo for utilizar
    db.run('CREATE TABLE IF NOT EXISTS substances (' +
      'substance_id INTEGER PRIMARY KEY, ' +
      'code VARCHAR(15) NOT NULL UNIQUE, ' +
      'group_id INTEGER, ' +
      'reference VARCHAR(15), ' +
      'description VARCHAR(127), ' +
      'sped VARCHAR(127), ' +
      'warning VARCHAR(127), ' +
      'warning_obs VARCHAR(255), ' +
      'cas VARCHAR(31), ' +
      'capsule_damage_factor VARCHAR(15), ' +
      'mw VARCHAR(31), ' +
      'boiling_point VARCHAR(15), ' +
      'vapor_pressure VARCHAR(15), '+
      'logp VARCHAR(15), ' +
      'general_obs VARCHAR(63), ' +
      'FOREIGN KEY (group_id) REFERENCES groups (group_id) ON DELETE CASCADE ON UPDATE NO ACTION);');

    // criacao da tabela de formulas
    // group_id, code, number_of_ingredientes, capsule_damage_factor, logp e vapor pressure, total_parts sao todas calculadas
    db.run('CREATE TABLE IF NOT EXISTS formulas (' +
      'formula_id INTEGER PRIMARY KEY, ' +
      'my_substance_id INTEGER, ' +
      'group_id INTEGER, ' +
      'name VARCHAR (127) NOT NULL, ' +
      'total_parts VARCHAR (127) NOT NULL, ' +
      'number_of_ingredients INTEGER, ' + 
      'logp REAL, ' +
      'vapor_pressure REAL, '+
      'capsule_damage_factor REAL, ' +
      'FOREIGN KEY (group_id) REFERENCES groups (group_id) ON DELETE CASCADE ON UPDATE NO ACTION, ' +
      'FOREIGN KEY (my_substance_id) REFERENCES substances (substance_id) ON DELETE CASCADE ON UPDATE NO ACTION);');

    //criacao da tabela formula_substance que vincula as substancias às formulas na criação de formulas
    db.run('CREATE TABLE IF NOT EXISTS formula_substance (' + 
      'formula_id INTEGER, substance_id INTEGER, parts REAL, ' + 
      'FOREIGN KEY (formula_id) REFERENCES formulas (formula_id) ON DELETE CASCADE ON UPDATE NO ACTION, ' + 
      'FOREIGN KEY (substance_id) REFERENCES substances (substance_id) ON DELETE CASCADE ON UPDATE NO ACTION);');
  });

  db.close();
}

exports.drop_db = function () {
  // incializacao do db com o path
  let db = new sqlite3.Database(database_path)

  // dropa todas as tabelas msm e fodase
  db.serialize(function () {
    db.run('DELETE FROM formula_substance');
    /*db.run('DROP TABLE IF EXISTS formula_substance')
    db.run('DROP TABLE IF EXISTS formulas')
    db.run('DROP TABLE IF EXISTS substances')
    db.run('DROP TABLE IF EXISTS groups')*/
  })

  db.close();
}

exports.populate_db = function () {
  // funcao para popular o banco de dados da planilha
  // a planilha se encontra em others e se chama planilha.xlsx
  // a primeira linha da planilha representa como as colunas devem ser chamadas e como são chamadas no banco de dados originalmente
  let xlsxj = require("xlsx-to-json");

  // funcao que popula a tabela de substancias
  // o result eh um vetor com objetos JSON dentro
  // input eh o caminho pra planilha que vai ser lida
  xlsxj({
    input: "others/planilha.xlsx", 
    output: "others/planilha.json"
  }, function(err, result) {
    if(err) {
      console.error(err);
    }else {
      // incializacao do db com o path
      let db = new sqlite3.Database(database_path)

      db.serialize(function () {
        //insercao dos nomes das tabelas de grupos
        //TODO: ver com pops se vai ser isso msm (mas elas representam as classes 1,2,3 e 4)
        db.run('INSERT INTO groups VALUES (1, "A")');
        db.run('INSERT INTO groups VALUES (2, "B")');
        db.run('INSERT INTO groups VALUES (3, "C")');
        db.run('INSERT INTO groups VALUES (4, "D")');
        db.run('INSERT INTO groups VALUES (5, "N")');

        //insercao dos valores na tabela de formulas
        //TODO: no final nao vai ficar aqui mas estamos deixando para testes
        /*db.run('INSERT INTO formulas (name, group_id, number_of_ingredients, total_parts, logp, vapor_pressure, capsule_damage_factor) VALUES ($name, $group_id, $number_of_ingredients, $logp, $vapor_pressure, $capsule_damage_factor, $total_parts)', 
          {$name:'MALBEC O BOTICÁRIO VERSÃO DE CELEBRAÇÃO DE 20 ANOS MASCULINO', $group_id:2,
            $number_of_ingredients: 110, $logp:0.35, $vapor_pressure:100, $capsule_damage_factor:1.0, $total_parts: 1});
        db.run('INSERT INTO formulas (name, group_id, number_of_ingredients, total_parts, logp, vapor_pressure, capsule_damage_factor) VALUES ($name, $group_id, $number_of_ingredients, $logp, $vapor_pressure, $capsule_damage_factor, $total_parts)', 
          {$name:'MALBEC O BOTICÁRIO VERSÃO DE CELEBRAÇÃO DE 20 ANOS FEMININO', $group_id:1,
            $number_of_ingredients: 100, $logp:0.7, $vapor_pressure:1, $capsule_damage_factor:1.1, $total_parts: 1});
        db.run('INSERT INTO formulas (name, group_id, number_of_ingredients, total_parts, logp, vapor_pressure, capsule_damage_factor) VALUES ($name, $group_id, $number_of_ingredients, $logp, $vapor_pressure, $capsule_damage_factor, $total_parts)', 
          {$name:'MALBEC O BOTICÁRIO VERSÃO 1.0', $group_id:3,
            $number_of_ingredients: 90, $logp:0.094, $vapor_pressure:2, $capsule_damage_factor:1.2, $total_parts: 1});
        db.run('INSERT INTO formulas (name, group_id, number_of_ingredients, total_parts, logp, vapor_pressure, capsule_damage_factor) VALUES ($name, $group_id, $number_of_ingredients, $logp, $vapor_pressure, $capsule_damage_factor, $total_parts)', 
          {$name:'MALBEC O BOTICÁRIO VERSÃO 2.0', $group_id:4,
            $number_of_ingredients: 1234, $logp:1.2, $vapor_pressure:3, $capsule_damage_factor:1.3, $total_parts: 1});*/

        //debugger;

        let stmt = db.prepare('INSERT INTO substances (code, group_id, reference, description, sped, warning, warning_obs, ' 
            + 'cas, capsule_damage_factor, mw, boiling_point, vapor_pressure, logp, general_obs) VALUES ($code, $group_id, $reference, $description, $sped, $warning, $warning_obs, ' 
            + '$cas, $capsule_damage_factor, $mw, $boiling_point, $vapor_pressure, $logp, $general_obs)')

        for (let i = 0;i < result.length;i++) {
          // deleta-se essa chave que eu nao sei pq vem junto, mas ela interfere (dando ) se não deletar no método de insert
          delete result[i][''];

          // simplesmente pula o ultimo elemento que tem todas as chaves nulas, 
          // mas basta verificar o code que nunca eh nulo
          if (result[i].$code == "")
            continue;

          //atribui-se o group_id certo de acordo com as equações de retas
          result[i].$group_id = util_service.groupIdByLogpAndVaporPressure(result[i].$logp, result[i].$vapor_pressure);

          stmt.run(result[i]);
        }

        stmt.finalize();

      })

      db.close();
    }
  });
}