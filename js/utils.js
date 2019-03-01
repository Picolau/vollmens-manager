const RECOMMENDED_RANGE_PERCENTAGES = {
	typeA: {min: 20, max: 50},
	typeB: {min: 20, max: 100},
	typeC: {min:0, max: 25},
	capsule_damage: {min: 0, med: 1.2, max: 1.6}
}

const code_size = 5;

//y = ax + b
const line1 = {a :0.7900, b: -4.205};
const line2 = {a :0.7812, b: -6.484};

exports.key_code_from_formula_id = function(formula_id) {
	//code eh pego do id da formula atual
  let code = formula_id.toString();

  //acrescentamos os zeros na frente do id
  while (code.length < code_size) code = '0' + code;

  //novo code
  return 'F' + code;
}

exports.groupIdByLogpAndVaporPressure = function (str_logp, str_vaporp) {
	if (str_logp == 'ND' && str_vaporp == 'ND' || str_logp == "" && str_vaporp == "" || 
		str_logp == '0.00' && str_vaporp == '0') 
		return 5; // TYPE N (UNKNOWN PRODUCTS OS LOGPS E OS VAPOR_PRESSURES SERÃO DESCONSIDERADOS NAS CONTAS)

	let logp  = parseFloat(str_logp);
	let logvp = Math.log10(parseFloat(str_vaporp));
	let point = {x: logp, y: logvp};

	if (logp <= 2.0)
		return 4;

	if (relative_pos_in_line(point, line1) == 'above')
		return 1;
	else if (relative_pos_in_line(point, line2) == 'above')
		return 2;

	return 3;
}

exports.recommended_range_percentages = function () {
	return RECOMMENDED_RANGE_PERCENTAGES;
}

let relative_pos_in_line = (point, line) => {
	let yOfThePointInTheLine = point.x * line.a + line.b;

	if (point.y >= yOfThePointInTheLine)
		return 'above';

	return 'below';
}