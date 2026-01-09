const badWords = [
  // Spanish profanity and vulgar terms
  'puta', 'puto', 'putas', 'putos', 'putita', 'putito', 'putaza', 'putazo',
  'mierda', 'mierdas', 'mierdero', 'mierdera', 'mierdoso', 'mierdosa',
  'carajo', 'carajos', 'carajito', 'carajita', 'carajillo', 'carajilla',
  'verga', 'vergas', 'vergon', 'vergona', 'vergaso', 'vergazo', 'vergacion',
  'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada', 'pendejadas',
  'pendejete', 'pendejito', 'pendejita', 'pendejón', 'pendejona',
  'culero', 'culera', 'culeros', 'culeras', 'culerísimo', 'culerísima',
  'chingar', 'chingada', 'chingado', 'chingadera', 'chingaderas',
  'chingon', 'chingona', 'chingones', 'chingonas', 'chingue', 'chinguen',
  'joder', 'jodido', 'jodida', 'jodidos', 'jodidas', 'jodete', 'jodanse',
  'coño', 'coños', 'coñazo', 'coñazos', 'coñete', 'coñetes',
  'marica', 'maricas', 'maricon', 'maricones', 'maricona', 'mariconas',
  'mariconcito', 'mariconcita', 'mariconada', 'mariconadas',
  'gonorrea', 'gonorreas', 'gonorreado', 'gonorreada',
  'hijueputa', 'hijueputas', 'hijueperra', 'hijueperras', 'hijuemadre',
  'malparido', 'malparida', 'malparidos', 'malparidas', 'malparidez',
  'berraco', 'berraca', 'berracos', 'berracas', 'berracada', 'berracadas',
  'carechimba', 'carechimbas', 'careculo', 'careculos', 'carepija',
  'caremonda', 'caremondas', 'caremierda', 'careverga',
  'chimba', 'chimbas', 'chimbada', 'chimbadas', 'chimbita', 'chimbito',
  'guevon', 'guevona', 'guevones', 'guevonas', 'guevonada', 'guevonadas',
  'huevon', 'huevona', 'huevones', 'huevonas', 'huevonada', 'huevonadas',
  'boludo', 'boluda', 'boludos', 'boludas', 'boludez', 'boludeces',
  'pelotudo', 'pelotuda', 'pelotudos', 'pelotudas', 'pelotudez', 'pelotudeces',
  'concha', 'conchas', 'conchudo', 'conchuda', 'conchudos', 'conchudas',
  'conchatumadre', 'conchetumare', 'conchesumadre', 'reconcha', 'recontraconcha',
  'chucha', 'chuchas', 'chuchada', 'chuchadas', 'chuchazo', 'chuchazos',
  'pirobo', 'piroba', 'pirobos', 'pirobas', 'pirobada', 'pirobadas',
  'sapo', 'sapa', 'sapos', 'sapas', 'sapito', 'sapita', 'sapazo',
  'mamaguevo', 'mamagüevo', 'mamaguevos', 'mamagüevos', 'mamawebo',
  'mamaverga', 'mamavergon', 'mamerto', 'mamerta', 'mamertos', 'mamertas',
  'mamabicho', 'mamabichos', 'bicho', 'bichos', 'bichote', 'bichota',
  'güevon', 'güevona', 'güevones', 'güevonas', 'aweonao', 'aweonado',

  // Spanish derogatory and offensive terms
  'imbecil', 'imbeciles', 'imbécil', 'imbéciles', 'imbecilidad',
  'idiota', 'idiotas', 'idiotez', 'idioteces', 'idiótez',
  'estupido', 'estupida', 'estupidos', 'estupidas', 'estupidez', 'estupideces',
  'estúpido', 'estúpida', 'estúpidos', 'estúpidas', 'estúpidez',
  'maldito', 'maldita', 'malditos', 'malditas', 'maldicion', 'maldición',
  'desgraciado', 'desgraciada', 'desgraciados', 'desgraciadas', 'desgracia',
  'cabron', 'cabrona', 'cabrones', 'cabronas', 'cabronada', 'cabronadas',
  'cabrón', 'cabrona', 'cabrones', 'cabronas', 'cabronazo', 'cabronete',
  'zorra', 'zorras', 'zorro', 'zorros', 'zorrita', 'zorrito', 'zorrazo',
  'perra', 'perras', 'perro', 'perros', 'perrita', 'perrito', 'perrazo',
  'rata', 'ratas', 'ratero', 'ratera', 'rateros', 'rateras', 'ratazo',
  'basura', 'basuras', 'basurero', 'basurera', 'basuriento', 'basurienta',
  'porqueria', 'porquerías', 'porquería', 'porqueroso', 'porquerosa',

  // Spanish body-related and crude terms
  'caca', 'cacas', 'caquita', 'caquitas', 'cagon', 'cagona', 'cagones',
  'culo', 'culos', 'culito', 'culitos', 'culazo', 'culazos', 'culón',
  'culona', 'culones', 'culonas', 'culicagado', 'culicagada',
  'tetas', 'teta', 'tetona', 'tetonas', 'tetuda', 'tetudas', 'tetazo',
  'pene', 'penes', 'pito', 'pitos', 'pitito', 'piton', 'pitón',
  'vagina', 'vaginas', 'panoch', 'panocha', 'panochas', 'papaya',

  // Spanish sexual and adult content terms
  'sexo', 'sexual', 'sexuales', 'sexualidad', 'sexista', 'sexistas',
  'porno', 'pornografia', 'pornografía', 'pornografico', 'pornográfico',
  'xxx', 'triple x', 'adulto', 'adultos', 'erótico', 'erotico',
  'prostituta', 'prostitutas', 'prostituto', 'prostitutos', 'prostitucion',
  'escort', 'escorts', 'scort', 'scorts', 'prepago', 'prepagos',
  'dama de compañia', 'damas de compañía', 'ramera',
  'masturbacion', 'masturbación', 'masturbar', 'masturbarse', 'masturbador',
  'pajero', 'pajera', 'pajeros', 'pajeras', 'paja', 'pajas', 'pajita',
  'mamada', 'mamadas', 'chupada', 'chupadas', 'mamadita', 'mamaditas',

  // Spanish drug-related terms
  'drogas', 'droga', 'drogado', 'drogada', 'drogadicto', 'drogadicta',
  'cocaina', 'cocaína', 'coca', 'perico', 'perica', 'farlopa',
  'marihuana', 'marijuana', 'mota', 'hierba', 'yerba', 'porro', 'porros',
  'cannabis', 'thc', 'hachis', 'hachís', 'hash', 'kush', 'weed',
  'heroina', 'heroína', 'chiva', 'caballo', 'jaco', 'metadona',
  'metanfetamina', 'meta', 'cristal', 'ice', 'speed', 'anfetamina',
  'extasis', 'éxtasis', 'mdma', 'molly', 'pastilla', 'pastillas',
  'lsd', 'acido', 'ácido', 'tripi', 'pepa', 'hongos', 'peyote',
  'borracho', 'borracha', 'borrachos', 'borrachas', 'borrachera', 'borracheras',
  'alcoholico', 'alcoholica', 'alcoholicos', 'alcoholicas', 'alcoholismo',
  'ebrio', 'ebria', 'ebrios', 'ebrias', 'ebriedad', 'embriagado',

  // Spanish violence and threat terms
  'asesino', 'asesina', 'asesinos', 'asesinas', 'asesinar', 'asesinato',
  'matar', 'matanza', 'matanzas', 'homicidio', 'homicidios', 'homicida',
  'muerte', 'muerto', 'muerta', 'muertos', 'muertas', 'cadaver', 'cadáver',
  'suicidio', 'suicida', 'suicidas', 'suicidarse', 'matarse', 'autoeliminarse',
  'arma', 'armas', 'pistola', 'pistolas', 'revolver', 'revolvers',
  'rifle', 'rifles', 'fusil', 'fusiles', 'escopeta', 'escopetas',
  'ametralladora', 'ametralladoras', 'metralleta', 'metralletas',
  'bomba', 'bombas', 'explosivo', 'explosivos', 'explosion', 'explosión', 'detonar',
  'terrorista', 'terroristas', 'terrorismo',

  // Spanish discriminatory and hate speech terms
  'racista', 'racistas', 'racismo', 'xenofobia', 'xenofobo', 'xenofoba',
  'nazi', 'nazis', 'nazismo', 'fascista', 'fascistas', 'fascismo',
  'hitler', 'hitlerian', 'supremacista', 'supremacistas', 'supremacia',
  'negro', 'negra', 'negros', 'negras', 'negrito', 'negrita',
  'gringo', 'gringos', 'gringa', 'gringas', 'gabacho', 'gabachos',
  'sudaca', 'sudacas', 'sudaco', 'sudacos', 'panchito', 'panchitos',
  'indio', 'india', 'indios', 'indias', 'indigena', 'indigenas',
  'cholo', 'chola', 'cholos', 'cholas', 'naco', 'naca', 'nacos', 'nacas',
  'joto', 'jotos', 'jota', 'jotas', 'jotito', 'jotita',
  'tortillera', 'tortilleras', 'lesbiana', 'lesbianas', 'lesbico',
  'travesti', 'travestis', 'travestido', 'travestida', 'transexual',
  'hermafrodita', 'hermafroditas', 'intersexual', 'intersexuales',

  // Spanish body functions and medical terms
  'pedo', 'pedos', 'pedorro', 'pedorra', 'pedorrero', 'pedorrera',
  'vomito', 'vomitar', 'vomitado', 'vomitada', 'vomitando', 'vomitona',
  'meado', 'meada', 'mear', 'mearse', 'orina', 'orinar', 'orinado',
  'cagado', 'cagada', 'cagar', 'cagarse', 'defecacion', 'defecación',
  'flatulencia', 'flatulencias', 'eructo', 'eructar', 'eructando', 'regüeldo',
  'moco', 'mocos', 'mocoso', 'mocosa', 'mocosos', 'mocosas',
  'escupir', 'escupitajo', 'gargajo', 'flema', 'esputo', 'salivajo',
  'pus', 'purulento', 'purulenta', 'infeccion', 'infectado', 'infectada',
  'enfermedad', 'enfermo', 'enferma', 'contagio', 'contagioso', 'contagiosa',
  'sida', 'vih', 'herpes', 'gonorrea', 'sifilis', 'sífilis',
  'venerea', 'venereo', 'venereas', 'venereos', 'ets', 'its',
  'cancer', 'cáncer', 'tumor', 'tumores', 'metastasis', 'metástasis',
  'leucemia', 'linfoma', 'carcinoma', 'sarcoma', 'melanoma',

  // Spanish derogatory terms for mental capacity
  'retrasado', 'retrasada', 'retrasados', 'retrasadas', 'retraso',
  'subnormal', 'subnormales', 'anormal', 'anormales', 'anormalidad',
  'mogolico', 'mogolica', 'mogolicos', 'mogolicas', 'mogolicada',
  'mongoloide', 'mongoloides', 'mongolo', 'mongola', 'mongolismo',
  'cretino', 'cretina', 'cretinos', 'cretinas', 'cretinismo',
  'tarado', 'tarada', 'tarados', 'taradas', 'taradez', 'taradeces',

  // Spanish regional vulgar terms
  'gilipollas', 'gilipolla', 'gilipollo', 'gilipollez', 'gilipolleces',
  'capullo', 'capullos', 'capulla', 'capullas', 'capullada', 'capulladas',
  'hostia', 'hostias', 'ostia', 'ostias', 'hostion', 'ostiazo',
  'cojones', 'cojon', 'cojonudo', 'cojonuda', 'acojonante', 'descojonante',
  'follar', 'folla', 'follado', 'follada', 'follador', 'folladora',
  'pinche', 'pinches', 'pinchado', 'pinchada', 'pinchurriento',
  'culiao', 'culiado', 'culiada', 'culiados', 'culiadas', 'culiar',
  'weón', 'weon', 'weones', 'weona', 'weonas', 'aweonao',

  // Spanish abbreviations and slang
  'conchetumare', 'ctm', 'csm', 'hdp', 'hp', 'ptm', 'cdm',
  'recontraputamadre', 'putamadre', 'mamahuevo', 'mamawebo', 'mamaguevo',
  'vergatario', 'vergacion', 'vergaso', 'vergon', 'vergona', 'averga',
  'culicagado', 'culicagada', 'culiado', 'culiada', 'culiadito',
  'chupamedias', 'chupapijas', 'chupapija', 'chupaverga', 'chupaculos',
  'lameculos', 'lameculo', 'lamebotas', 'lamebota', 'lameplatos',
  'comeculo', 'comemierda', 'comemierdas', 'tragasable', 'tragaleche',
  'sorete', 'soretes', 'soretudo', 'soretuda', 'soretazo', 'soretazos',

  // Spanish sexual and inappropriate terms
  'pervertido', 'pervertida', 'perverso', 'perversa', 'depravado',
  'depravada', 'degenerado', 'degenerada', 'vicioso', 'viciosa',
  'pedofilo', 'pedofila', 'pedofilos', 'pedofilas', 'pedofilia',
  'pederasta', 'pederastas', 'pederastia', 'abusador', 'abusadora',
  'zoofilia', 'zoofilico', 'zoofilica', 'necrofilia', 'necrofilo',
  'incesto', 'incestuoso', 'incestuosa', 'violador', 'violadora',
  'violacion', 'violación', 'violar', 'violadores', 'violadoras',
  'abuso', 'abusar', 'abusivo', 'abusiva', 'abusadores', 'abusadoras',
  'acoso', 'acosar', 'acosador', 'acosadora', 'acosamiento', 'acosadores',

  // English profanity and vulgar terms
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fuckface',
  'fuckhead', 'fuckwit', 'fucktard', 'fuckboy', 'fuckgirl', 'fuckoff',
  'motherfucker', 'motherfuckers', 'motherfucking', 'mofo', 'mofos',
  'shit', 'shits', 'shitty', 'shittier', 'shittiest', 'shithead',
  'shitface', 'shithole', 'shitstorm', 'shitshow', 'shitbag',
  'bullshit', 'horseshit', 'dogshit', 'batshit', 'apeshit', 'chickenshit',
  'bitch', 'bitches', 'bitchy', 'bitchier', 'bitchiest', 'bitchass',
  'bitchface', 'bitchboy', 'bitchtits', 'bitchslap', 'bitchin',
  'ass', 'asses', 'asshole', 'assholes', 'asshat', 'asswipe',
  'assclown', 'asslicker', 'asskisser', 'assface', 'assbag',
  'dumbass', 'dumbasses', 'smartass', 'jackass', 'badass', 'fatass',
  'dick', 'dicks', 'dickhead', 'dickface', 'dickwad', 'dickweed',
  'dicknose', 'dickless', 'dickbag', 'dickhole', 'dickweasel',
  'pussy', 'pussies', 'pussycat', 'pussyfoot', 'pussywhipped', 'pussyboy',
  'cock', 'cocks', 'cocksucker', 'cocksuckers', 'cocksucking', 'cockhead',
  'cockface', 'cockwomble', 'cockwaffle', 'cockmuncher', 'cockblock',
  'damn', 'damned', 'dammit', 'goddamn', 'goddamnit', 'goddam', 'goddammit',
  'hell', 'hells', 'hellhole', 'hellish', 'hellfire', 'hellbound', 'hellraiser',
  'bastard', 'bastards', 'bastardly', 'dastardly', 'bastardize',
  'cunt', 'cunts', 'cunty', 'cuntface', 'cuntbag', 'cunthole',
  'whore', 'whores', 'whorish', 'whorehouse', 'whoremaster',
  'slut', 'sluts', 'slutty', 'sluttier', 'sluttiest', 'slutbag',
  'sonofabitch', 'son of a bitch', 'sonovabitch', 'sonuvabitch',
  'scumbag', 'scumbags', 'scumball', 'scumbucket', 'scumsucker',
  'douchebag', 'douchebags', 'douche', 'douchecanoe', 'douchewagon',
  'douchenozzle', 'douchebucket', 'doucheface', 'douchemonkey',
  'twat', 'twats', 'twatface', 'twatwaffle', 'twathead', 'twatweasel',

  // English British slang and vulgar terms
  'wanker', 'wankers', 'wanking', 'wank', 'wanked', 'tosser', 'tossers',
  'bollocks', 'bollocking', 'bollocked', 'bollock', 'bollox',
  'bloody', 'bloodier', 'bloodiest', 'blimey', 'crikey', 'cor',
  'bugger', 'buggered', 'buggering', 'buggers', 'buggery',
  'sod', 'sodding', 'sodded', 'sods', 'sodomy', 'sodomite',
  'prick', 'pricks', 'prickface', 'prickhead', 'prickish',
  'knob', 'knobs', 'knobhead', 'knobend', 'knobber', 'knobjockey',
  'bellend', 'bellends', 'pillock', 'pillocks', 'plonker', 'plonkers',
  'minger', 'mingers', 'minging', 'munter', 'munters', 'munting',
  'slag', 'slags', 'slagging', 'slagged', 'slapper', 'slappers',
  'scrubber', 'scrubbers', 'tart', 'tarts', 'tarty', 'tartish',
  'trollop', 'trollops', 'harlot', 'harlots', 'strumpet', 'strumpets',
  'hussy', 'hussies', 'jezebel', 'jezebels', 'floozy', 'floozies',
  'tramp', 'tramps', 'trampy', 'skank', 'skanks', 'skanky', 'skankier',
  'ho', 'hoe', 'hoes', 'hoebag', 'hoochie', 'hoochies',

  // English internet slang and modern terms
  'thot', 'thots', 'simp', 'simps', 'simping', 'simped',
  'cuck', 'cucks', 'cucked', 'cucking', 'cuckold', 'cuckolds',
  'incel', 'incels', 'femcel', 'femcels', 'volcel', 'volcels',
  'mgtow', 'redpill', 'blackpill', 'bluepill', 'whitepill',
  'doomer', 'doomers', 'coomer', 'coomers', 'cooming', 'coomed',
  'boomer', 'boomers', 'zoomer', 'zoomers', 'bloomer', 'bloomers',
  'karen', 'karens', 'chad', 'chads', 'stacy', 'stacys', 'stacies',
  'becky', 'beckys', 'beckies', 'normie', 'normies', 'normalfag',

  // English racial slurs and discriminatory terms
  'nigger', 'niggers', 'nigga', 'niggas', 'niggaz', 'nigguh',
  'chink', 'chinks', 'chinky', 'gook', 'gooks', 'nip', 'nips',
  'spic', 'spics', 'spick', 'spicks', 'beaner', 'beaners',
  'wetback', 'wetbacks', 'greaser', 'greasers', 'spook', 'spooks',
  'fag', 'fags', 'faggot', 'faggots', 'faggy', 'faggoty',
  'queer', 'queers', 'queerbait', 'queerbaiting', 'queermo',
  'dyke', 'dykes', 'bulldyke', 'bulldykes', 'lesbo', 'lesbos',
  'tranny', 'trannies', 'trannie', 'trannys', 'shemale', 'shemales',

  // English hate speech and extremism terms
  'racist', 'racists', 'racism', 'xenophobia', 'xenophobic', 'nazi', 'nazism',
  'fascist', 'fascism', 'hitler', 'supremacist', 'supremacy',
  'terrorist', 'terrorism', 'bomb', 'explosive', 'explosives',

  // English violence and weapon terms
  'kill', 'murder', 'assassinate', 'death', 'dead', 'corpse',
  'suicide', 'suicidal', 'weapon', 'weapons', 'gun', 'pistol',
  'rifle', 'bomb', 'explosive', 'explosives',

  // English sexual and inappropriate content
  'porn', 'porno', 'xxx', 'sex', 'penis', 'vagina', 'breasts', 'tits',
  'masturbation', 'masturbate', 'masturbating', 'rape', 'rapist',
  'abuse', 'abuser', 'abusive', 'harassment', 'harass', 'harasser',
  'pedophile', 'pedophiles', 'pedophilia', 'zoophilia', 'necrophilia',
  'incest', 'incestuous', 'pervert', 'perverted', 'perverse', 'depraved',

  // English drugs and substances
  'drugs', 'cocaine', 'marijuana', 'weed', 'heroin', 'meth',
  'addict', 'addiction', 'drunk', 'alcoholic', 'high', 'stoned',

  // English body functions and medical terms
  'vomit', 'vomiting', 'puke', 'puking', 'urine', 'urinate',
  'defecate', 'defecation', 'fart', 'farting', 'burp', 'burping',
  'spit', 'spitting', 'snot', 'mucus', 'pus', 'infection', 'infected',
  'aids', 'hiv', 'herpes', 'gonorrhea', 'syphilis', 'std', 'sti',
  'cancer', 'tumor', 'tumors', 'metastasis', 'leukemia', 'lymphoma',
  'carcinoma', 'sarcoma', 'melanoma',

  // English derogatory terms for mental capacity
  'retard', 'retarded', 'retards', 'moron', 'morons', 'idiot', 'idiots',
  'stupid', 'stupidity', 'dumb', 'dumber', 'dumbest', 'imbecile',
  'imbeciles', 'cretin', 'cretins', 'abnormal', 'abnormals',
  'subnormal', 'subnormals', 'mongoloid', 'mongoloids'
]

const irrelevantTerms = [
  // Basic articles and prepositions (English)
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'may', 'might', 'must', 'shall', 'should',
  'this', 'that', 'these', 'those', 'it', 'its', 'itself',
  'he', 'she', 'him', 'her', 'his', 'hers', 'they', 'them',
  'their', 'theirs', 'we', 'us', 'our', 'ours', 'you', 'your',
  'yours', 'me', 'my', 'mine', 'myself', 'yourself', 'himself',
  'herself', 'themselves', 'ourselves', 'yourselves', 'oneself',
  'who', 'whom', 'whose', 'which', 'what', 'where', 'when',
  'why', 'how', 'here', 'there', 'now', 'then', 'today',
  'yesterday', 'tomorrow', 'soon', 'later', 'before', 'after',
  'during', 'while', 'until', 'since', 'from', 'to', 'at',
  'in', 'on', 'off', 'up', 'down', 'out', 'over', 'under',
  'above', 'below', 'between', 'among', 'through', 'across',
  'into', 'onto', 'upon', 'within', 'without', 'inside',
  'outside', 'near', 'far', 'close', 'away', 'around', 'behind',
  'beside', 'besides', 'beyond', 'past', 'toward', 'towards',
  'against', 'along', 'amid', 'amidst', 'amongst', 'underneath',

  // Basic responses and interjections
  'yes', 'no', 'ok', 'okay', 'yeah', 'yep', 'yup', 'nope',
  'nah', 'sure', 'fine', 'alright', 'right', 'wrong', 'true',
  'false', 'maybe', 'perhaps', 'possibly', 'probably', 'definitely',
  'certainly', 'absolutely', 'exactly', 'precisely', 'indeed',
  'really', 'actually', 'basically', 'literally', 'virtually',
  'practically', 'essentially', 'generally', 'usually', 'normally',
  'typically', 'commonly', 'rarely', 'seldom', 'hardly', 'barely',
  'almost', 'nearly', 'quite', 'rather', 'fairly', 'pretty',
  'somewhat', 'slightly', 'extremely', 'incredibly', 'amazingly',
  'totally', 'completely', 'entirely', 'fully', 'wholly', 'utterly',
  'thoroughly', 'perfectly', 'purely', 'simply', 'merely', 'just',
  'only', 'even', 'still', 'yet', 'already', 'also', 'too',
  'either', 'neither', 'both', 'all', 'any', 'some', 'many',
  'few', 'several', 'various', 'different', 'same', 'other',
  'another', 'each', 'every',

  // Numbers and ordinals
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty',
  'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred',
  'thousand', 'million', 'billion', 'trillion', 'first', 'second',
  'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth',
  'tenth', 'last', 'next', 'previous', 'former', 'latter', 'single',
  'double', 'triple', 'half', 'quarter', 'whole', 'part', 'piece',
  'bit', 'lot', 'much', 'more', 'most', 'less', 'least', 'little',

  // Basic adjectives
  'big', 'large', 'small', 'great', 'good', 'bad', 'better', 'worse',
  'best', 'worst', 'new', 'old', 'young', 'long', 'short', 'high',
  'low', 'tall', 'wide', 'narrow', 'thick', 'thin', 'heavy', 'light',
  'hard', 'soft', 'hot', 'cold', 'warm', 'cool', 'wet', 'dry',
  'clean', 'dirty', 'full', 'empty', 'open', 'closed', 'free',
  'busy', 'easy', 'difficult', 'simple', 'complex', 'clear',
  'unclear', 'obvious', 'hidden', 'visible', 'invisible', 'public',
  'private', 'common', 'rare', 'normal', 'strange', 'weird', 'odd',
  'unusual', 'regular', 'special', 'general', 'specific', 'particular',
  'certain', 'sure', 'unsure', 'safe', 'dangerous', 'risky', 'secure',
  'strong', 'weak', 'powerful', 'powerless', 'rich', 'poor', 'cheap',
  'expensive', 'fast', 'slow', 'quick', 'rapid', 'sudden', 'gradual',
  'immediate', 'instant', 'delayed', 'early', 'late', 'timely',
  'untimely', 'temporary', 'permanent', 'brief', 'lengthy', 'endless',
  'limited', 'unlimited', 'finite', 'infinite', 'complete', 'incomplete',
  'partial', 'total', 'blank', 'null', 'void', 'none', 'zero',
  'nothing', 'everything', 'anything', 'something', 'somewhere',
  'anywhere', 'everywhere', 'nowhere', 'someone', 'anyone', 'everyone',
  'no one', 'nobody', 'everybody', 'anybody', 'somebody', 'whoever',
  'whatever', 'whichever', 'whenever', 'wherever', 'however', 'whyever',

  // Spanish articles and basic words
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'al', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'y', 'o', 'pero',
  'si', 'no', 'que', 'como', 'cuando', 'donde', 'quien', 'cual',
  'cuanto', 'muy', 'mas', 'menos', 'mucho', 'poco', 'todo', 'nada',
  'algo', 'alguien', 'nadie', 'siempre', 'nunca', 'hola', 'adios',
  'gracias', 'por favor', 'vale', 'bien', 'mal', 'tal vez', 'quizas',
  'quizás', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
  'nueve', 'diez', 'cien', 'mil', 'millon', 'millón', 'primero',
  'segundo', 'tercero', 'ultimo', 'último', 'proximo', 'próximo',
  'anterior', 'siguiente', 'este', 'ese', 'aquel', 'esta', 'esa',
  'aquella', 'esto', 'eso', 'aquello', 'estos', 'esos', 'aquellos',
  'estas', 'esas', 'aquellas', 'yo', 'tu', 'tú', 'él', 'ella',
  'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas',
  'usted', 'ustedes', 'mi', 'mis', 'tus', 'su', 'sus', 'nuestro',
  'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros',
  'vuestras', 'mio', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos',
  'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'me', 'te', 'se', 'le',
  'les', 'nos', 'os', 'lo', 'aqui', 'aquí', 'ahi', 'ahí', 'alli',
  'allí', 'alla', 'allá', 'aca', 'acá', 'arriba', 'abajo', 'delante',
  'detras', 'detrás', 'dentro', 'fuera', 'cerca', 'lejos', 'encima',
  'debajo', 'ahora', 'luego', 'despues', 'después', 'antes', 'ayer',
  'hoy', 'mañana', 'pronto', 'tarde', 'temprano', 'todavia', 'todavía',
  'aun', 'aún', 'ya', 'apenas', 'recien', 'recién',

  // Common verbs (Spanish)
  'ser', 'estar', 'haber', 'tener', 'hacer', 'poder', 'decir', 'ir',
  'ver', 'dar', 'saber', 'querer', 'llegar', 'pasar', 'deber', 'poner',
  'parecer', 'quedar', 'creer', 'hablar', 'llevar', 'dejar', 'seguir',
  'encontrar', 'llamar', 'venir', 'pensar', 'salir', 'volver', 'tomar',
  'conocer', 'vivir', 'sentir', 'tratar', 'mirar', 'contar', 'empezar',
  'esperar', 'buscar', 'existir', 'entrar', 'trabajar', 'escribir',
  'perder', 'producir', 'ocurrir', 'entender', 'pedir', 'recibir',
  'recordar', 'terminar', 'permitir', 'aparecer', 'conseguir', 'comenzar',
  'servir', 'sacar', 'necesitar', 'mantener', 'resultar', 'leer', 'caer',
  'cambiar', 'presentar', 'crear', 'abrir', 'considerar', 'oír', 'acabar',
  'suponer', 'comprender', 'lograr', 'explicar', 'reconocer', 'estudiar',
  'intentar', 'ayudar', 'realizar', 'jugar', 'tocar', 'ganar', 'correr',
  'andar', 'mover', 'subir', 'bajar', 'partir', 'viajar', 'caminar',
  'nadar', 'volar', 'conducir', 'manejar',

  // Test and spam patterns
  'test', 'testing', 'prueba', 'asdf', 'qwerty', '123', '1234', '12345',
  '123456', '1234567', '12345678', 'qwer', 'qwert', 'qwertz', 'qwertyuiop',
  'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm', 'poiuyt', 'lkjhgf', 'mnbvcx',
  'abc', 'abcd', 'abcde', 'abcdef', '111', '222', '333', '444', '555',
  '666', '777', '888', '999', '000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999', '0000',

  // Repeated characters and spam
  'aaa', 'aaaa', 'aaaaa', 'bbb', 'bbbb', 'bbbbb', 'ccc', 'cccc', 'ddd',
  'dddd', 'eee', 'eeee', 'fff', 'ffff', 'ggg', 'gggg', 'hhh', 'hhhh',
  'iii', 'iiii', 'jjj', 'jjjj', 'kkk', 'kkkk', 'lll', 'llll', 'mmm',
  'mmmm', 'nnn', 'nnnn', 'ooo', 'oooo', 'ppp', 'pppp', 'qqq', 'qqqq',
  'rrr', 'rrrr', 'sss', 'ssss', 'ttt', 'tttt', 'uuu', 'uuuu', 'vvv',
  'vvvv', 'www', 'wwww', 'xxx', 'yyy', 'yyyy', 'zzz', 'zzzz',

  // Internet slang and expressions
  'lol', 'lmao', 'rofl', 'lmfao', 'omg', 'wtf', 'brb', 'afk', 'idk',
  'imo', 'imho', 'tbh', 'ngl', 'fr', 'ong', 'smh', 'fyi', 'btw',
  'aka', 'asap', 'eta', 'faq', 'tbd', 'tba', 'lolol', 'lololol',
  'lmaooo', 'roflmao', 'lmfaooo', 'jaja', 'jeje', 'jajaja', 'jejeje',
  'jajaj', 'jajajaja', 'jajajajaja', 'jejej', 'jojojojo', 'jijiji',
  'hahaha', 'hehehe', 'hahahaha', 'hehehehe', 'hohohoho', 'hihihihi',
  'xd', 'xdd', 'xddd', 'xdddd', 'xddddd', 'kkkk', 'kkkkk', 'rsrsrs',
  'rsrsrsrs', 'zzzzz',

  // Basic interjections and sounds
  'ah', 'oh', 'eh', 'uh', 'mm', 'hmm', 'mhm', 'aha', 'ooh', 'wow',
  'meh', 'blah', 'bleh', 'ugh', 'argh', 'grr', 'pfft', 'tsk', 'bah',
  'pff', 'pssh', 'shh', 'shhh', 'oops', 'whoops', 'yikes', 'eek',
  'yay', 'hooray', 'hurray', 'woo', 'woohoo', 'yippee', 'yahoo',
  'whee', 'weee', 'weeee'
]

const spamPatterns = [
  /^(.)\1{3,}$/,
  /^\d+$/,
  /^[^a-záéíóúñ]+$/i,
  /(.{2,})\1{2,}/,
  /^[!@#$%^&*()_+=\[\]{};':"\\|,.<>/?]+$/
]

export function isInappropriate(query: string): boolean {
  const normalized = query.toLowerCase().trim()
  
  if (normalized.length < 2) return true
  
  if (irrelevantTerms.includes(normalized)) return true
  
  for (const badWord of badWords) {
    if (normalized.includes(badWord)) return true
  }
  
  for (const pattern of spamPatterns) {
    if (pattern.test(normalized)) return true
  }
  
  return false
}

export function sanitizeSearchQuery(query: string): string | null {
  const trimmed = query.trim()
  
  if (trimmed.length < 2 || trimmed.length > 100) return null
  
  if (isInappropriate(trimmed)) return null
  
  return trimmed
}

export function isValidSearchTerm(query: string): boolean {
  const sanitized = sanitizeSearchQuery(query)
  return sanitized !== null
}
