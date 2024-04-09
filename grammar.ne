expression -> number "+" number {%
    function(data) {
        return {
            operator: "sum",
            leftOperand:  data[0],
            rightOperand: data[2] // data[1] is "+"
        };
    }
%}

number -> [0-9]:+ {% d => parseInt(d[0].join("")) %}
