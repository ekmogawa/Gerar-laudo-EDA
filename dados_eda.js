// ============================================================
// BANCO DE DADOS — Gerar Laudo EDA
// Salvo em: 24/03/2026, 13:06:45
// ============================================================

var DB_PADRAO = {
  "equipamento": [
    {
      "nome": "EG-760Z",
      "id": "EG-760Z",
      "valor": "Exame realizado com equipamento Fujifilm EG-760Z, que possui magnificação de imagem e cromoscopia digital."
    },
    {
      "nome": "EG-590Z",
      "valor": "Exame realizado com equipamento Fujifilm EG-590Z, que possui magnificação de imagem e cromoscopia digital."
    },
    {
      "nome": "GIF-H170",
      "id": "170-sortable-equipamento",
      "valor": "Exame realizado com equipamento Olympus GIF-H170, que possui imagem HD e cromoscopia digital."
    },
    {
      "nome": "GIF-H180",
      "valor": "Exame realizado com equipamento Olympus GIF-H180, que possui imagem HD e cromoscopia digital."
    },
    {
      "nome": "GIF-H190",
      "valor": "Exame realizado com equipamento Olympus GIF-H190, que possui imagem HD e cromoscopia digital."
    },
    {
      "nome": "GIF-HQ190",
      "valor": "Exame realizado com equipamento Olympus GIF-HQ190, que possui imagem HD, near focus e cromoscopia digital."
    }
  ],
  "sedacao": [
    {
      "nome": "Anestesista",
      "id": "anestesista",
      "valor": "equipe de anestesiologia."
    },
    {
      "nome": "UTI",
      "id": "UTI",
      "valor": "equipe intensivista."
    },
    {
      "nome": "Anestesia geral",
      "id": "geral",
      "valor": "Paciente sob anestesia geral."
    }
  ],
  "sedacaoSelects": {
    "fentanil": [
      "50mcg",
      "75mcg",
      "100mcg",
      ""
    ],
    "midazolam": [
      "",
      " + Midazolam 1mg",
      " + Midazolam 2mg",
      " + Midazolam 2,5mg",
      " + Midazolam 3mg",
      " + Midazolam 4mg",
      " + Midazolam 5mg"
    ]
  },
  "esofago": [
    {
      "nome": "Normal",
      "id": "checkbox4",
      "valor": "calibre e distensibilidade preservados. Ausência de lesões de mucosa. A transição esofagogástrica coincide com o pinçamento diafragmático."
    },
    {
      "nome": "LAA",
      "id": "checkbox5",
      "valor": "calibre e distensibilidade preservados. Presença de erosões menores que 5 mm ao nível da transição esofagogástrica, que coincide com o pinçamento diafragmático."
    },
    {
      "nome": "LAB",
      "id": "checkbox6",
      "valor": "calibre e distensibilidade preservados. Presença de erosões lineares não confluentes maiores que 5 mm ao nível da transição esofagogástrica, que coincide com o pinçamento diafragmático."
    },
    {
      "nome": "LAC",
      "id": "checkbox7",
      "valor": "calibre e distensibilidade preservados. Presença de erosões maiores que 5 mm, confluindo e ocupando cerca de 40% da circunferência, ao nível da transição esofagogástrica, que coincide com o pinçamento diafragmático."
    },
    {
      "nome": "LAD",
      "id": "checkbox8",
      "valor": "calibre e distensibilidade preservados. Presença de erosões maiores que 5 mm, confluindo e ocupando toda a circunferência do órgão ao nível da transição esofagogástrica, que coincide com o pinçamento diafragmático."
    },
    {
      "nome": "HHD",
      "id": "checkbox9",
      "valor": "calibre e distensibilidade preservados. Ausência de lesões de mucosa. A transição esofagogástrica está deslocada cerca de 2cm acima do pinçamento diafragmático."
    },
    {
      "nome": "HH+LAA",
      "id": "checkbox10",
      "valor": "calibre e distensibilidade preservados. Presença de erosões menores que 5mm ao nível da transição esofagogástrica, que está deslocada cerca de 2cm acima do pinçamento diafragmático."
    },
    {
      "nome": "HH+LAB",
      "valor": "calibre e distensibilidade preservados. Presença de erosões lineares não confluentes mairoes que 5mm ao nível da transição esofagogástrica, que está deslocada cerca de 2cm acima do pinçamento diafragmático."
    },
    {
      "nome": "HH+LAC",
      "valor": "calibre e distensibilidade preservados. Presença de erosões que confluem ocupando cerca de 40% da circunferência ao nível da transição esofagogástrica, que está deslocada cerca de 2cm acima do pinçamento diafragmático."
    },
    {
      "nome": "Esof NE",
      "id": "esofne",
      "valor": "calibre e distensibilidade preservados. A mucosa apresenta edema no terço distal, porém sem erosões. A transição esofagogástrica coincide com o pinçamento diafragmático."
    },
    {
      "nome": "Barrett",
      "id": "Barrett",
      "valor": "calibre e distensibilidade preservados. Presença de digitação de mucosa de aspecto colunar medindo cerca de 10mm; realizada avaliação com cromoscopia digital e biópsia. A transição esofagogástrica coincide com o pinçamento diafragmático."
    },
    {
      "nome": "HH+Barrett",
      "valor": "calibre e distensibilidade preservados. Presença de digitações de mucosa com aspecto colunar medindo até cerca de 10mm a partir da transição esofagogástrica, que está deslocada cerca de 2cm acima do pinçamento diafragmático. Realizada cromoscopia com ácido acético, não sendo identificadas áreas suspeitas para displasia. Biópsias."
    },
    {
      "nome": "Varizes",
      "valor": "calibre e distensibilidade preservados. Ausência de lesões de mucosa. Presença de cordões varicosos retilíneos e azulados medindo cerca de 5mm, sem sinais de cor vermelha, no terço distal. A transição esofagogástrica coincide com o pinçamento diafragmático."
    },
    {
      "nome": "Lig Varizes",
      "valor": "calibre e distensibilidade preservados. Ausência de lesões de mucosa. Presença de dois cordões varicosos tortuosos e de coloração arroxeada apresentando pontos avermelhados no terço distal. A transição esofagogástrica coincide com o pinçamento diafragmático.<br><br>Realizada ligadura elástica após exame dos demais segmentos sem intercorrências."
    },
    {
      "nome": "Esof em resol",
      "valor": "calibre e distensibilidade preservados. Presença de erosões reparadas ao nível da transição esofagogástrica, que coincide com o pinçamento diafragmático."
    }
  ],
  "estomago": [
    {
      "nome": "Normal",
      "id": "checkbox11",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa está preservada em todos os segmentos. Incisura angular sem alterações. Piloro centrado e pérvio."
    },
    {
      "nome": "Pang en leve",
      "id": "checkbox12",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta edema e enantema discretos difusamente. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Pang en mod",
      "id": "checkbox13",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta edema e enantema moderados difusamente com pontos de sufusão hemorrágica no centro de áreas gástricas no corpo, aspecto correlacionado com infecção por H. pylori. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Pang en eros ant",
      "id": "checkbox14",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta edema e enantema moderados difusamente com erosões planas no antro. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Gast en ant",
      "id": "checkbox15",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa está preservada em fundo e corpo, notando-se enantema discreto no antro. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Gast eros ant",
      "id": "checkbox16",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa está preservada em fundo e corpo, notando-se raras erosões planas recobertas por fibrina no antro. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Pang eros",
      "id": "checkbox17",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta algumas erosões planas recobertas por fibrina em corpo e antro. Incisura angular sem lesões. Piloro centrado e pérvio."
    },
    {
      "nome": "Pol gast",
      "id": "polgast",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa está preservada em todos os segmentos, exceto por alguns pólipos sésseis medindo até 5mm no corpo gástrico; realizadas polipectomias de dois deles para amostragem. Incisura angular sem alterações. Piloro centrado e pérvio."
    },
    {
      "nome": "Restos alim",
      "valor": "Presença de moderada quantidade de restos alimentares sólidos em câmara gástrica. Optado por interrupção do exame devido a risco de broncoaspiração."
    },
    {
      "nome": "GCA C-1 gast at",
      "id": "checkbox18",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta enantema e edema discretos e difusos no corpo. Na incisura angular e antro, o enantema é entremeado por áreas de palidez com relevo reduzido. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA C-1",
      "id": "checkbox19",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa está relativamente preservada em fundo e corpo. Na incisura angular e antro, a mucosa é discretamente pálida com relevo reduzido (Kimura-Takemoto C-1), aspecto possivelmente correlacionado com quadro de infecção prévia por H. pylori (pós-tratamento). Piloro centrado e pérvio."
    },
    {
      "nome": "GCA C-2 gast at",
      "id": "checkbox20",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta enantema e edema discretos e difusos, notando-se enantema entremeado por áreas de palidez e relevo reduzido na pequena curvatura do corpo distal, incisura angular e antro. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA C-2",
      "id": "checkbox21",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta aspecto relativamente preservado na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo distal, incisura angular e todo o antro. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA C-3 gast at",
      "id": "checkbox22",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta enantema e edema moderados e difusos na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo, incisura angular e todo o antro. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA C-3",
      "id": "GCAC3",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta aspecto relativamente preservado na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo, incisura angular e todo o antro. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA O-1",
      "id": "gcao1",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso normotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta-se pálida com relevo reduzido em parte do corpo. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA O-2",
      "id": "gcao2",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso hipotrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta-se pálida com relevo reduzido e vasos submucosos evidentes na maior parte do corpo, incisura angular e todo o antro. Piloro centrado e pérvio."
    },
    {
      "nome": "GCA O-3",
      "id": "gcao3",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso atrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta-se pálida com relevo reduzido e vasos submucosos evidentes em todos os segmentos. Piloro centrado e pérvio."
    },
    {
      "nome": "Autoimune",
      "valor": "volume e distensibilidade preservados. Líquido claro em volume regular. Pregueado mucoso atrófico. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta-se pálida com relevo reduzido e vasos submucosos evidentes em fundo e corpo, notando-se aspecto relativamente preservado no antro. Piloro centrado e pérvio."
    },
    {
      "nome": "MI associada",
      "id": "checkboxmi",
      "valor": ""
    },
    {
      "separador": true
    },
    {
      "nome": "Fundop",
      "id": "checkbox23",
      "valor": "volume e distensibilidade preservados. Líquido claro em pequeno volume. Pregueado mucoso normotrófico. À retroversão, nota-se fundoplicatura tópica e continente. A mucosa está preservada em todos os segmentos. Incisura angular sem alterações. Piloro centrado e pérvio."
    },
    {
      "nome": "Gastrect Y",
      "id": "gastrecty",
      "valor": "presença de conteúdo líquido bilioso em moderada quantidade. A câmara gástrica residual mede cerca de 10cm pela pequena curvatura. A mucosa apresenta edema e enantema moderados difusamente, com algumas placas amareladas compatíveis com xantoma. À retroversão, o hiato diafragmático está ajustado ao aparelho. Anastomose gastrojejunal termino-lateral com cerca de 20mm sem lesões associadas; realizadas biópsias de anastomose. "
    },
    {
      "nome": "Gastrect BII",
      "id": "gastrectBII",
      "valor": "presença de conteúdo líquido bilioso em moderada quantidade. A câmara gástrica residual mede cerca de 10cm pela pequena curvatura. A mucosa apresenta edema e enantema moderados difusos, com algumas placas amareladas compatíveis com xantoma. À retroversão, o hiato diafragmático está ajustado ao aparelho. Anastomose gastrojejunal termino-lateral com cerca de 20mm sem lesões associadas. "
    },
    {
      "nome": "Bypass",
      "id": "checkbox24",
      "valor": "câmara gástrica residual medindo cerca de 2,5cm pela pequena curvatura, apresentando mucosa preservada. Anastomose gastrojejunal terminolateral com cerca de 1,5cm, sem lesões."
    },
    {
      "nome": "Gastrop vert",
      "valor": "ausência de grande curvatura do corpo por cirurgia prévia. Líquido claro em pequeno volume. A mucosa está preservada em todos os segmentos. Transição corpo-antro apresentando angulação habitual. Piloro centrado e pérvio."
    },
    {
      "nome": "Gastrop vert+Pang en leve",
      "valor": "ausência de grande curvatura do corpo por cirurgia prévia. Líquido claro em pequeno volume. A mucosa apresenta edema e enantema discretos em todos os segmentos. Transição corpo-antro apresentando angulação habitual. Piloro centrado e pérvio."
    },
    {
      "nome": "Santoro",
      "id": "checkbox25",
      "valor": "volume discretamente reduzido em consequência de ressecção cirúrgica de grande curvatura do corpo, observando-se retração cicatricial nesta topografia. Líquido claro em pequeno volume. Hiato diafragmático ajustado ao aparelho, quando visto em retroversão. A mucosa apresenta edema e enantema discretos em todos os segmentos. Incisura angular sem lesões. Na grande curvatura da transição corpo-antro, encontra-se anastomose gastroenteral medindo cerca de 10-15mm, sem lesões; alça enteral percorrida por cerca de 15cm, sem lesões. Antro anatomicamente preservado e piloro pérvio."
    },
    {
      "nome": "Desc. GTT",
      "valor": "Sinais de transiluminação e digitopressão presentes em parede anterior do corpo médio.<br>Antissepsia e colocação de campos.<br>Anestesia local com lidocaína tópica a 2%.<br>Punção com gelco sob visão endoscópica em ponto previamente demarcado.<br>Passagem de sonda de gastrostomia 20FR por técnica de tração, fixada com anteparo justo à parede anterior do corpo gástrico e móvel à rotação com marca de 3cm ao nível da pele.<br>Curativo oclusivo."
    }
  ],
  "duodeno": [
    {
      "nome": "Normal",
      "id": "checkbox26",
      "valor": "bulbo amplo e sem retrações, com mucosa preservada. Início da segunda porção sem alterações."
    },
    {
      "nome": "BD en",
      "id": "checkbox27",
      "valor": "bulbo amplo e sem retrações, apresentando enantema discreto. Início da segunda porção sem alterações."
    },
    {
      "nome": "BD eros",
      "id": "checkbox28",
      "valor": "bulbo amplo e sem retrações, apresentando algumas erosões planas recobertas por fibrina. Início da segunda porção sem alterações."
    },
    {
      "nome": "Cic bulb",
      "id": "checkbox29",
      "valor": "bulbo amplo com retração cicatricial em parede anterossuperior de sua porção média, delimitando pseudodivertículo. Início da segunda porção sem alterações."
    },
    {
      "nome": "Div 2a",
      "id": "checkbox30",
      "valor": "bulbo amplo e sem retrações, com mucosa preservada. Presença de óstio diverticular em início da segunda porção, adjacente à papila duodenal maior."
    },
    {
      "nome": "SNE",
      "valor": "<br>Realizada passagem de sonda de Dobbhoff pelo óstio nasal direito com extremidade distal locada em segunda porção duodenal. Retirada de fio guia e fixação com sonda retificada em orofaringe."
    }
  ],
  "jejuno": [
    {
      "nome": "Gastrect BII",
      "id": "gastropvertjej",
      "valor": "alça aferente longa, voltada para grande curvatura, apresentando conteúdo bilioso e terminando em fundo cego sem lesões. Alça eferente voltada para pequena curvatura, percorrida por cerca de 20cm, sem lesões."
    },
    {
      "nome": "Bypass",
      "id": "jejbypass",
      "valor": "alça aferente curta em fundo cego voltada para grande curvatura e sem lesões. Alça eferente voltada para pequena curvatura, percorrida por cerca de 20cm, sem lesões."
    },
    {
      "nome": "Gastrect Y",
      "id": "gastrect y jejuno",
      "valor": "alça aferente curta em fundo cego voltada para grande curvatura e sem lesões. Alça eferente voltada para pequena curvatura, percorrida por cerca de 20cm, sem lesões."
    }
  ],
  "conclusao": [
    {
      "nome": "Normal",
      "id": "concnormal",
      "valor": "- Exame dentro dos padrões de normalidade."
    },
    {
      "nome": "LAA",
      "id": "checkbox31",
      "valor": "- Esofagite erosiva distal leve - Los Angeles A."
    },
    {
      "nome": "LAB",
      "id": "checkbox32",
      "valor": "- Esofagite erosiva distal moderada - Los Angeles B."
    },
    {
      "nome": "LAC",
      "id": "checkbox33",
      "valor": "- Esofagite erosiva distal moderada - Los Angeles C."
    },
    {
      "nome": "LAD",
      "id": "checkbox34",
      "valor": "- Esofagite erosiva distal intensa - Los Angeles D."
    },
    {
      "nome": "Esof NE",
      "id": "esofneconc",
      "valor": "- Esofagite não erosiva."
    },
    {
      "nome": "Esof em resol",
      "valor": "- Esofagite erosiva distal em resolução."
    },
    {
      "nome": "HHD",
      "id": "checkbox35",
      "valor": "- Hérnia hiatal por deslizamento."
    },
    {
      "nome": "Barrett",
      "valor": "- Digitação de mucosa colunar em esôfago distal (sugestivo de esôfago de Barrett - Praga C0M1)."
    },
    {
      "nome": "Varizes",
      "valor": "- Varizes esofágicas de médio calibre. Sem necessidade de tratamento endoscópico no momento."
    },
    {
      "nome": "Lig Varizes",
      "valor": "- Ligadura elástica de varizes esofágicas. Revisão endoscópica em 6 semanas. Prescrito IBP por 14 dias e realizadas orientações de dieta, repouso relativo e de sinais de alerta."
    },
    {
      "nome": "Pang en leve",
      "id": "checkbox37",
      "valor": "- Pangastrite enantematosa leve."
    },
    {
      "nome": "Pang en mod",
      "id": "checkbox38",
      "valor": "- Pangastrite enantematosa moderada."
    },
    {
      "nome": "Pang en eros ant",
      "id": "checkbox39",
      "valor": "- Pangastrite enantematosa com erosões no antro."
    },
    {
      "nome": "Gast en ant",
      "id": "checkbox40",
      "valor": "- Gastrite enantematosa leve do antro."
    },
    {
      "nome": "Gast eros ant",
      "id": "checkbox41",
      "valor": "- Gastrite erosiva leve do antro."
    },
    {
      "nome": "Pang eros",
      "id": "checkbox42",
      "valor": "- Pangastrite erosiva moderada."
    },
    {
      "nome": "Pol gast",
      "id": "polgastconc",
      "valor": "- Pólipos em corpo gástrico. Polipectomias de amostragem."
    },
    {
      "nome": "GCA C-1 gast at",
      "id": "checkbox43",
      "valor": "- Pangastrite em cronificação (Kimura-Takemoto C-1). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA C-1",
      "id": "checkbox44",
      "valor": "- Aspecto endoscópico de atrofia inicial em antro.\n- Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA C-2 gast at",
      "id": "checkbox45",
      "valor": "- Pangastrite em cronificação (Kimura-Takemoto C-2). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA C-2",
      "id": "checkbox46",
      "valor": "- Gastrite crônica com área de atrofia inicial (Kimura-Takemoto C-2). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA C-3 gast at",
      "id": "checkbox47",
      "valor": "- Gastrite crônica com área moderada de atrofia (Kimura-Takemoto C-3) e gastrite ativa. Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA C-3",
      "id": "checkbox48",
      "valor": "- Gastrite crônica com área moderada de atrofia (Kimura-Takemoto C-3). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA O-1",
      "id": "checkbox49",
      "valor": "- Gastrite crônica com área moderada de atrofia (Kimura-Takemoto O-1). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA O-2",
      "id": "checkbox50",
      "valor": "- Gastrite crônica com área extensa de atrofia (Kimura-Takemoto O-2). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "GCA O-3",
      "id": "gcao3conc",
      "valor": "- Gastrite crônica atrófica (Kimura-Takemoto O-3). Realizadas biópsias de antro e corpo para investigação histológica de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "Autoimune",
      "valor": "- Gastrite atrófica com aspecto endoscópico sugestivo de etiologia autoimune. Realizadas biópsias de corpo e antro para investigação de atrofia e pesquisa de H. pylori."
    },
    {
      "nome": "Fundop",
      "id": "checkbox51",
      "valor": "- Status pós-operatório de fundoplicatura gástrica."
    },
    {
      "nome": "Gastrect Y",
      "id": "gastrectYconc",
      "valor": "- Status pós-operatório de gastrectomia parcial com reconstrução em Y de Roux."
    },
    {
      "nome": "Gastrect BII",
      "id": "gastrectBIIconc",
      "valor": "- Status pós-operatório de gastrectomia parcial com reconstrução à Billroth II."
    },
    {
      "nome": "Bypass",
      "id": "checkbox52",
      "valor": "- Status pós-operatório de bypass gástrico."
    },
    {
      "nome": "Gastrop vert",
      "id": "checkbox53",
      "valor": "- Status pós-operatório de gastroplastia vertical."
    },
    {
      "nome": "Santoro",
      "id": "santoroconc",
      "valor": "- Status pós-operatório de gastroplastia por técnica de Santoro."
    },
    {
      "nome": "Desc. GTT",
      "valor": "- Realizada gastrostomia endoscópica sem intercorrências.\n"
    },
    {
      "nome": "BD en",
      "id": "checkbox54",
      "valor": "- Bulboduodenite enantematosa leve."
    },
    {
      "nome": "BD eros",
      "id": "bderos",
      "valor": "- Bulboduodenite erosiva moderada."
    },
    {
      "nome": "Cic bulb",
      "id": "Cicbulb",
      "valor": "- Cicatriz bulbar."
    },
    {
      "nome": "Div 2a",
      "id": "checkbox56",
      "valor": "- Divertículo em segunda porção duodenal."
    },
    {
      "nome": "SNE",
      "valor": "- Passagem de sonda nasoenteral."
    },
    {
      "separador": true
    },
    {
      "nome": "Urease-",
      "id": "checkbox57",
      "valor": "- Realizadas biópsias de corpo e antro para pesquisa de H. pylori pelo método da urease, que resultou negativo."
    },
    {
      "nome": "Urease+",
      "id": "checkbox58",
      "valor": "- Realizadas biópsias de corpo e antro para pesquisa de H. pylori pelo método da urease, que resultou <b>POSITIVO</b>."
    },
    {
      "nome": "Histo",
      "id": "checkbox59",
      "valor": "- Realizadas biópsias de corpo e antro para pesquisa de H. pylori pelo método histológico."
    },
    {
      "nome": "Bx HP e duod",
      "id": "bxduod",
      "valor": "- Realizadas biópsias gástricas para pesquisa de H. pylori e biópsias de bulbo e segunda porção duodenal."
    },
    {
      "nome": "Obs IBP",
      "valor": "<br>Obs: o uso de inibidores de bomba de prótons nos 7 dias que antecedem a endoscopia digestiva alta causa redução significante da sensibilidade dos testes de detecção de H. pylori."
    },
    {
      "nome": "Obs ATB",
      "valor": "<br>Obs: o uso de antibióticos nos 30 dias que antecedem a endoscopia digestiva alta causa redução significante da sensibilidade dos testes de detecção de H. pylori."
    },
    {
      "nome": "Alça",
      "valor": "Material especial: alça de polipectomia."
    },
    {
      "nome": "Pinça",
      "valor": "<br>Material especial: pinça de biópsia."
    },
    {
      "nome": "Marília",
      "valor": "<br>Obs: realizado por Dra. Marília Seber e acompanhado por Dr. Eduardo Ogawa."
    },
    {
      "nome": "Letícia",
      "valor": "<br>Obs: realizado por Dra. Letícia Volpe e acompanhado por Dr. Eduardo Ogawa."
    },
    {
      "nome": "Valéria",
      "valor": "<br>Obs: realizado por Dra. Valéria e acompanhado por Dr. Eduardo Ogawa."
    },
    {
      "nome": "Gabriela",
      "valor": "<br>Obs: realizado por Dra. Gabriela e acompanhado por Dr. Eduardo Ogawa."
    }
  ],
  "outros": [
    {
      "nome": "Atestado M",
      "id": "atestadohomem",
      "valor": "<strong style='bold'>ATESTADO MÉDICO</strong><br><br><br><br>Atesto que o paciente foi submetido a exame com sedação hoje e deve permanecer afastado de suas atividades laborais pelo restante do dia.<br><br><br><br><br>CID-10: Z019"
    },
    {
      "nome": "Atestado F",
      "id": "atestadomulher",
      "valor": "<strong style='bold'>ATESTADO MÉDICO</strong><br><br><br><br>Atesto que a paciente foi submetida a exame com sedação hoje e deve permanecer afastada de suas atividades laborais pelo restante do dia.<br><br><br><br><br>CID-10: Z019"
    },
    {
      "nome": "Pantoprazol",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>Pantoprazol 20mg<br><br>Tomar um comprimido 20 minutos antes do café da manhã e do jantar por 14 dias.<br><br><br>"
    },
    {
      "nome": "Fiber mais",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>1. Fiber Mais<br><br>Misturar uma medida a um copo de água ou suco e tomar uma vez ao dia por 15 dias.<br><br><br>2- Buscopan composto gotas<br><br>Tomar 20 gotas de 6 em 6 horas, se tiver cólicas abdominais.<br><br><br>3- Proctyl pomada<br><br>Passar na região anal de 8 em 8 horas, se tiver desconforto anal."
    },
    {
      "nome": "Cipro",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>1. Ciprofloxacino 500mg<br><br>Tomar um comprimido de 12 em 12 horas por 05 dias.<br><br><br>2- Pantoprazol 20mg<br><br>Tomar um comprimido 20 minutos antes do café da manhã e do jantar por 07 dias.<br><br><br>3- Buscopan composto gotas<br><br>Tomar 20 gotas de 6 em 6 horas, se tiver cólicas abdominais.<br><br><br>"
    },
    {
      "nome": "Pyloripac",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>1. Pantoprazol 20 mg <br><br>Tomar um comprimido de 12 em 12 horas por 14 dias (antes de iniciar tratamento com Pyloripac).<br><br><br>2. Pyloripac (Lansoprazol 30mg + Amoxicilina 500mg + Claritromicina 500mg)<br><br>Tomar de 12 em 12 horas por 14 dias.<br>- Amoxicilina 02 comprimidos<br>- Claritromicina 01 comprimido<br>- Lansoprazol 01 comprimido<br><br>Após término dos 14 dias iniciais, manter Lansoprazol 01 comprimido de 12 em 12 horas por mais 14 dias."
    },
    {
      "nome": "TTO HP gen",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>1- Omeprazol 20mg, Cápsula <br><br>Tomar 1 cápsula 20 minutos antes do café da manhã e do jantar por 30 dias.<br><br><br>2- Amoxicilina 500g, Comprimido<br><br>Tomar 2 comprimidos 20 minutos antes do café da manhã e do jantar por 14 dias.<br><br><br>3- Claritromicina 500mg, Comprimido<br><br>Tomar 1 comprimido 20 minutos antes do café da manhã e do jantar por 14 dias.<br><br><br>"
    },
    {
      "nome": "Orient ligadura",
      "id": "Orientação pós-ligadura-sortable-outros",
      "valor": "<strong style='bold'>ORIENTAÇÕES PÓS-LIGADURA ELÁSTICA DE VARIZES ESOFÁGICAS</strong><br><br><br><br>Não ingerir alimentos quentes por três (3) dias; somente frios ou temperatura ambiente.<br><br>Somente ingerir alimentos líquidos por três (3) dias. Após, iniciar ingesta de alimentos pastosos aumentando progressivamente a consistência e acrescentando sólidos amassados e depois picados. Retornar a dieta normal após sete (7) dias do exame.<br><br>Não ingerir alimentos duros como talos ou pães de casca grossa por dez (10) dias.<br><br>Não realizar esforços físicos moderados a intensos por sete (7) dias. Pode realizar caminhada leve.<br><br>Não ingerir bebidas alcoólicas.<br><br>Utilizar medicações conforme a receita em anexo.<br><br>Em caso de dor torácica, febre ou sangramento (vômitos com sangue vivo e/ou coágulos ou fezes escurecidas, amolecidas e com cheiro forte) comparecer imediatamente a Pronto Atendimento (PA)."
    },
    {
      "nome": "AP lesões",
      "valor": "Aos cuidados de Dr. Denilson Mayrink ou Dra. Juliana Micelli."
    },
    {
      "nome": "AP GCA",
      "valor": "1- bx de antro - pesquisa de H. pylori e atrofia\n2- bx de copro gástrico - pesquisa de H. pylori e atrofia\n\n\nAos cuidados de Dr. Denilson Mayrink ou Dra. Juliana Micelli."
    },
    {
      "nome": "Lesões pós",
      "valor": "ORIENTAÇÕES PÓS-TERAPÊUTICA ENDOSCÓPICA EM AMBULATÓRIO DE LESÕES:\n\n* Aguardar contato da Sra. Marina (AMB de lesões) e equipe médica da endoscopia para teleconsulta com informações sobre resultados da biópsias, necessidade de complementação terapêutica e programação de controle colonoscópico. NÃO É NECESSÁRIO AGENDAMENTO DE CONSULTA COM ESPECIALISTA ANTES DO NOSSO CONTATO.\n\nPara dúvidas, telefone corporativo Ambulatório de Lesões (Marina e Juliana): (11) 95324-4041\n\nOrientações:\n1. Dieta líquida ou pastosa com temperatura morna ou fria por 7 dias;\n2. Não realizar atividade física por 15 dias;\n3. Evitar exposição ao sol por períodos prolongados;\n4. Em caso de vômitos com sangue e coágulos, evacuação preta, tipo borra de café, com odor fétido ou dor abdominal intensa, procurar atendimento de urgência via Pronto Socorro do Hospital Madrid e/ou entrar em contato com Dr. Eduardo Ogawa (11 97632-1588)."
    },
    {
      "nome": "Panto; vonau; busco",
      "valor": "<strong style='bold'>Receituário Médico</strong><br><br><br><br>Pantoprazol 20mg<br><br>Tomar um comprimido 20 minutos antes do café da manhã e do jantar por 14 dias.<br><br><br>Vonau 4mg<br><br>Tomar um comprimido de 6 em 6 horas, se tiver násea.<br><br><br>Buscopan composto comprimido (10 mg/250 mg)<br><br>Tomar um comprimido de 4 em 4 horas, se tiver cólica."
    }
  ]
};
