/* ============================================================================
   bb_names.js · v0.2 · 2026-10-03

   Names for players, umpires, teams and ballparks, drawn from the engine's
   seeded random numbers so a seed replays the same people.

   A person's first and last names are drawn from the SAME origin pool, so a
   name hangs together; origins are weighted roughly like an MLB roster
   (about seven in ten born in the US, a quarter in Latin America, a few from
   Japan, Korea, Canada, Curaçao and Australia). Team nicknames avoid all
   thirty MLB nicknames; cities are real places without an MLB club, so every
   team is plainly fictional. The pools deliberately leave out first names and
   surnames that point at one real player (a random pairing must never
   reproduce a real person).

   A LEAGUE (v0.2, for bb_league.js): thirty organisations, each with a
   major-league club and five minor-league clubs. Joe (2026-10-03): the majors
   take larger cities and compelling animals or icons (a big city may have a
   real MLB club; the world is fictional), the minors smaller cities and more
   obscure ones. No nickname here belongs to a real major-league club in any
   sport or to a current minor-league baseball club we know of.

   CHANGED
     v0.2  league(): thirty organisations, each a major-league club and five minor-league clubs
     v0.1  first build - ~2,000 first-by-last combinations per origin pool
============================================================================ */

var BBNames = (function () {
  'use strict';

  var ORIGINS = [
    { w: 0.70, key: 'us',
      first: ['James', 'Michael', 'Tyler', 'Ryan', 'Jacob', 'Austin', 'Brandon', 'Cody', 'Logan', 'Dylan', 'Mason', 'Cole',
              'Hunter', 'Chase', 'Garrett', 'Travis', 'Kyle', 'Zach', 'Nick', 'Matt', 'Chris', 'Josh', 'Drew', 'Trevor',
              'Bryce', 'Brady', 'Colton', 'Wyatt', 'Luke', 'Jake', 'Sam', 'Ben', 'Will', 'Andrew', 'Nate', 'Evan',
              'Grant', 'Spencer', 'Tanner', 'Blake', 'Jordan', 'Marcus', 'Darius', 'Andre', 'Jalen', 'Terrance', 'Devin',
              'Cedric', 'Malik', 'Isaiah', 'Elijah', 'Xavier', 'DeShawn', 'Trey', 'Reggie', 'Corey', 'Shane', 'Derek',
              'Clayton', 'Carson', 'Brooks', 'Riley', 'Jackson', 'Owen', 'Caleb', 'Eli', 'Gavin', 'Parker', 'Reid',
              'Walker', 'Dalton', 'Brett', 'Casey', 'Seth', 'Joel', 'Adam', 'Aaron', 'Paul', 'Peter', 'Tom', 'Joe',
              'Dan', 'Mitch', 'Kevin', 'Sean', 'Patrick', 'Connor', 'Liam', 'Quinn', 'Nolan', 'Bo', 'Heston', 'Tate'],
      last:  ['Anderson', 'Baker', 'Bennett', 'Brooks', 'Bryant', 'Burke', 'Caldwell', 'Carter', 'Chandler', 'Coleman',
              'Collins', 'Cooper', 'Crawford', 'Dalton', 'Davis', 'Dawson', 'Dixon', 'Doyle', 'Ellis', 'Fisher',
              'Fletcher', 'Foster', 'Garrison', 'Gibson', 'Graham', 'Griffin', 'Hale', 'Harper', 'Hayes', 'Henderson',
              'Holloway', 'Hughes', 'Jennings', 'Jensen', 'Keller', 'Kendrick', 'Lawson', 'Lindgren', 'Marsh', 'McAllister',
              'McCoy', 'Mercer', 'Miller', 'Mitchell', 'Monroe', 'Morrison', 'Nash', 'Norris', 'Parker', 'Patterson',
              'Pierce', 'Porter', 'Pruitt', 'Quinlan', 'Reed', 'Reeves', 'Riggs', 'Robinson', 'Sanders', 'Sawyer',
              'Schaefer', 'Shelton', 'Simmons', 'Slater', 'Stafford', 'Stanton', 'Stewart', 'Sullivan', 'Thornton',
              'Tucker', 'Turner', 'Vaughn', 'Wade', 'Walsh', 'Warren', 'Watkins', 'Webb', 'Wheeler', 'Whitaker',
              'Whitfield', 'Wilder', 'Winslow', 'Wolfe', 'Yates', 'Kowalski', 'Novak', 'Brennan', "O'Neill", 'Gallagher',
              'Russo', 'Moretti', 'DeLuca', 'Hoffman', 'Brandt', 'Voss', 'Dunbar', 'Ransom', 'Tillman', 'Boone', 'Cash'] },
    { w: 0.25, key: 'latin',
      first: ['José', 'Luis', 'Carlos', 'Juan', 'Miguel', 'Rafael', 'Pedro', 'Francisco', 'Ángel', 'Jesús', 'Manuel',
              'Ronald', 'Julio', 'Eugenio', 'Emmanuel', 'Freddy', 'Cristian', 'Ezequiel', 'Randy', 'Wilmer', 'Enmanuel',
              'Andrés', 'Diego', 'Alejandro', 'Roberto', 'Héctor', 'Omar', 'Edwin', 'Víctor', 'Ramón', 'Nelson', 'Yunior',
              'Ronny', 'Orlando', 'Arístides', 'Fernando', 'Sandy', 'Kelvin', 'Elvis', 'Jorge', 'Santiago', 'Mateo',
              'Gabriel', 'Daniel', 'Eduardo', 'Ricardo', 'Sergio', 'Ernesto', 'Alberto', 'Wilson', 'Félix', 'Julián',
              'Esteban', 'Rubén', 'Darwin', 'Yeferson', 'Brayan', 'Wilfredo', 'Josué', 'Anderson'],
      last:  ['Martínez', 'Rodríguez', 'Pérez', 'García', 'Hernández', 'González', 'Ramírez', 'Sánchez', 'Torres',
              'Díaz', 'Reyes', 'Cruz', 'Ortiz', 'Gómez', 'Morales', 'Vargas', 'Castillo', 'Jiménez', 'Rosario',
              'Peralta', 'Guerrero', 'Soto', 'Marte', 'Polanco', 'Encarnación', 'Tavárez', 'Almonte', 'Batista',
              'Mejía', 'Féliz', 'Valdez', 'Abreu', 'Álvarez', 'Contreras', 'Suárez', 'Navarro', 'Rojas', 'Fuentes',
              'Salazar', 'Medina', 'Espinal', 'Paulino', 'De La Cruz', 'Santana', 'Peña', 'Lugo', 'Montero', 'Duarte',
              'Domínguez', 'Carrasco', 'Ventura', 'Cabrera', 'Bautista', 'Frías', 'Arroyo', 'Quintana', 'Villar', 'Tejada'] },
    { w: 0.02, key: 'japan',
      first: ['Hiroshi', 'Takeshi', 'Kenji', 'Daiki', 'Yuto', 'Ryo', 'Kenta', 'Daisuke', 'Hiroki', 'Takumi', 'Ryota',
              'Kazuki', 'Tomoyuki', 'Haruto', 'Sho', 'Yuki', 'Kaito', 'Ren', 'Sota', 'Naoki'],
      last:  ['Takeda', 'Arakawa', 'Nakamura', 'Yamada', 'Kobayashi', 'Sato', 'Tanaka', 'Watanabe', 'Ito', 'Morita',
              'Kuroda', 'Fujimoto', 'Hasegawa', 'Ishikawa', 'Maeda', 'Ogawa', 'Sakamoto', 'Shimizu', 'Ueda', 'Yoshida'] },
    { w: 0.01, key: 'korea',
      first: ['Min-jun', 'Seo-jun', 'Do-yun', 'Woo-jin', 'Jae-won', 'Ji-ho', 'Hyun-woo', 'Sung-min', 'Dong-hyun', 'Tae-yang'],
      last:  ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Han'] },
    { w: 0.02, key: 'other',
      first: ['Liam', 'Owen', 'Ruben', 'Jairo', 'Stefan', 'Lachlan', 'Cooper', 'Mitchell', 'Jordan', 'Travis', 'Callum',
              'Dwayne', 'Mathieu', 'Etienne', 'Hendrik', 'Jaylen'],
      last:  ['Martina', 'Hooi', 'Pieters', 'Koolhof', 'Doornbos', 'Kennedy', 'Thornbury', 'Macleod', 'Fraser', 'Leblanc',
              'Tremblay', 'Gagnon', 'Bouchard', 'Kerrigan', 'Whitlock', 'Vandermeer'] }
  ];

  var CITIES = ['Albuquerque', 'Boise', 'Portland', 'Sacramento', 'Nashville', 'Charlotte', 'Austin', 'Salt Lake',
                'Omaha', 'Oklahoma City', 'Louisville', 'Indianapolis', 'Columbus', 'Buffalo', 'Hartford', 'Richmond',
                'Raleigh', 'Memphis', 'New Orleans', 'Birmingham', 'Spokane', 'Tucson', 'El Paso', 'Des Moines',
                'Tulsa', 'Montréal', 'Vancouver', 'Honolulu', 'Anchorage', 'Fort Collins', 'Burlington', 'Savannah'];
  var NICKS = ['Foxes', 'Herons', 'Comets', 'Pioneers', 'Miners', 'Stags', 'Mustangs', 'Lumberjacks', 'Rivermen',
               'Owls', 'Condors', 'Sentinels', 'Voyagers', 'Beacons', 'Anglers', 'Coyotes', 'Ironworkers', 'Nighthawks',
               'Sandpipers', 'Bison', 'Grizzlies', 'Wolves', 'Harriers', 'Kestrels', 'Rattlers', 'Ospreys', 'Mudcats',
               'Thunderbirds', 'Surveyors', 'Engineers', 'Prospectors', 'Keelboats', 'Loggers', 'Cyclones', 'Steelheads'];
  // the league (v0.2): big cities and compelling names for the majors; small cities and obscure ones below
  var MAJOR_CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Philadelphia', 'Phoenix', 'San Antonio', 'San Diego',
                      'Dallas', 'Atlanta', 'Miami', 'Boston', 'Seattle', 'Denver', 'Detroit', 'Minneapolis', 'St. Louis',
                      'Baltimore', 'Pittsburgh', 'Cleveland', 'Washington', 'Toronto', 'Montréal', 'Kansas City', 'Tampa',
                      'Las Vegas', 'Portland', 'Nashville', 'Charlotte', 'San Francisco'];
  var MAJOR_NICKS = ['Condors', 'Orcas', 'Thunderbirds', 'Stallions', 'Bison', 'Pumas', 'Wolverines', 'Rattlers', 'Cobras',
                     'Vipers', 'Ospreys', 'Barracudas', 'Leopards', 'Elk', 'Moose', 'Stags', 'Typhoons', 'Comets', 'Meteors',
                     'Mastodons', 'Kodiaks', 'Sentinels', 'Harriers', 'Peregrines', 'Mustangs', 'Bighorns', 'Hammerheads',
                     'Stingrays', 'Glaciers', 'Ironclads', 'Dreadnoughts', 'Griffins', 'Cougars', 'Sabercats'];
  var MINOR_CITIES = ['Bozeman', 'Missoula', 'Tupelo', 'Kalamazoo', 'Dubuque', 'Muncie', 'Pueblo', 'Casper', 'Bend', 'Yakima',
                      'Elko', 'Ames', 'Stillwater', 'Lawrence', 'Paducah', 'Joplin', 'Texarkana', 'Hattiesburg', 'Valdosta',
                      'Dothan', 'Florence', 'Asheville', 'Roanoke', 'Lynchburg', 'Altoona', 'Utica', 'Bangor', 'Keene',
                      'Ithaca', 'Erie', 'Sandusky', 'Marquette', 'Duluth', 'Fargo', 'Bismarck', 'Rapid City', 'Cheyenne',
                      'Laramie', 'Flagstaff', 'Prescott', 'Yuma', 'Las Cruces', 'Amarillo', 'Abilene', 'Lubbock', 'Tyler',
                      'Waco', 'Lake Charles', 'Houma', 'Gadsden', 'Macon', 'Athens', 'Augusta', 'Spartanburg', 'Wilmington',
                      'Hagerstown', 'Cumberland', 'Morgantown', 'Wheeling', 'Zanesville', 'Lima', 'Kokomo', 'Terre Haute',
                      'Champaign', 'Peoria', 'Moline', 'Waterloo', 'Mankato', 'Eau Claire', 'Oshkosh', 'Traverse City',
                      'Saginaw', 'Bay City', 'Elmira', 'Binghamton', 'Scranton', 'Reading', 'Lancaster', 'Frederick',
                      'Salisbury', 'Dover', 'New Bedford', 'Pittsfield', 'Rutland', 'Concord', 'Lewiston', 'Brattleboro',
                      'Grand Junction', 'Durango', 'Pocatello', 'Twin Falls', 'Idaho Falls', 'Walla Walla', 'Medford',
                      'Eureka', 'Chico', 'Redding', 'Visalia', 'Modesto', 'Stockton', 'Bakersfield', 'Fresno', 'Salinas',
                      'San Luis Obispo', 'Santa Rosa', 'Klamath Falls', "Coeur d'Alene", 'Helena', 'Great Falls', 'Billings',
                      'Sheridan', 'Gillette', 'Scottsbluff', 'Kearney', 'Grand Island', 'Salina', 'Hutchinson', 'Dodge City',
                      'Enid', 'Lawton', 'Muskogee', 'Fort Smith', 'Jonesboro', 'Pine Bluff', 'Greenville', 'Meridian',
                      'Natchez', 'Monroe', 'Alexandria', 'Beaumont', 'Victoria', 'Laredo', 'San Angelo', 'Odessa', 'Roswell',
                      'Farmington', 'Gallup', 'Kingman', 'Hilo', 'Juneau', 'Fairbanks', 'Sitka', 'Thunder Bay', 'Sudbury',
                      'Moncton', 'Saint John', 'Kingston', 'Peterborough', 'Lethbridge', 'Kamloops', 'Nanaimo', 'Brandon',
                      'Regina', 'Saskatoon', 'Red Deer', 'Medicine Hat', 'Prince George', 'Trois-Rivières', 'Sherbrooke',
                      'Charlottetown', 'Fredericton'];
  var MINOR_NICKS = ['Pikas', 'Axolotls', 'Mudpuppies', 'Hellbenders', 'Shrikes', 'Gars', 'Bowfins', 'Paddlefish', 'Newts',
                     'Voles', 'Shrews', 'Kingsnakes', 'Horned Toads', 'Tarantulas', 'Ringtails', 'Coatis', 'Sculpins',
                     'Nightjars', 'Grackles', 'Muskrats', 'Weasels', 'Stoats', 'Salamanders', 'Cicadas', 'Katydids',
                     'Dragonflies', 'Sunfish', 'Crappies', 'Bullfrogs', 'Peepers', 'Mayflies', 'Box Turtles', 'Armadillos',
                     'Javelinas', 'Pronghorns', 'Marmots', 'Ptarmigans', 'Puffins', 'Killdeer', 'Moles', 'Possums', 'Skunks',
                     'Porcupines', 'Lampreys', 'Sturgeon', 'Mudskippers', 'Water Striders', 'Stoneflies', 'Chuckwallas',
                     'Gila Monsters', 'Jackrabbits', 'Prairie Dogs', 'Pocket Gophers', 'Burrowing Owls', 'Whippoorwills',
                     'Bobwhites', 'Woodcocks', 'Snipes', 'Egrets', 'Ibises', 'Cormorants', 'Grebes', 'Coots', 'Mergansers',
                     'Teals', 'Lungfish', 'Hagfish', 'Tadpoles', 'Toads', 'Walleyes', 'Muskies', 'Pickerel', 'Smelts',
                     'Alewives', 'Minnows', 'Darters', 'Chubs', 'Luna Moths', 'Orb Weavers', 'Scorpions', 'Centipedes',
                     'Millipedes', 'Tinkers', 'Millers', 'Coopers', 'Sawyers', 'Lamplighters', 'Riverboats', 'Haymakers',
                     'Gaslights', 'Brakemen', 'Switchmen', 'Linemen', 'Ploughboys', 'Canners', 'Smelters', 'Quarrymen',
                     'Glassblowers', 'Tanners', 'Chandlers', 'Wheelwrights', 'Blacksmiths', 'Cobblers', 'Bargemen',
                     'Ferrymen', 'Drovers', 'Sodbusters', 'Rainmakers', 'Stargazers', 'Tumbleweeds', 'Windmills',
                     'Pumpjacks', 'Paddlewheels', 'Telegraphs', 'Sternwheelers', 'Ice Cutters', 'Hop Pickers', 'Cranberries'];
  var PARK_A = ['Riverside', 'Union', 'Harbor', 'Summit', 'Liberty', 'Founders', 'Heritage', 'Lakeshore', 'Granite',
                'Meridian', 'Northgate', 'Canal', 'Prairie', 'Ironbridge', 'Cedar'];
  var PARK_B = ['Field', 'Park', 'Stadium', 'Ballpark', 'Grounds'];

  // Well-known real players and umpires these pools can spell by chance; a
  // draw that lands on one is simply drawn again.
  var BLOCK = {};
  ['Juan Soto', 'Julio Rodríguez', 'José Abreu', 'Miguel Cabrera', 'Freddy Peralta', 'Carlos Santana', 'Edwin Díaz',
   'Pedro Martínez', 'José Ramírez', 'Luis Castillo', 'José Reyes', 'Nelson Cruz', 'José Bautista', 'Félix Hernández',
   'Eugenio Suárez', 'Víctor Martínez', 'Carlos González', 'Diego Castillo', 'Ángel Hernández', 'Luis García',
   'Manuel Margot', 'Rafael Montero', 'Carlos Martínez', 'Ramón Hernández', 'Wilson Contreras', 'Jorge Soler',
   'Kyle Tucker', 'Bryce Harper', 'Mitch Keller', 'Logan Webb', 'Evan Carter', 'Mason Miller', 'Tyler Anderson',
   'Zach Wheeler', 'Cody Bellinger', 'Brandon Crawford', 'Drew Pomeranz', 'Andrew Miller', 'Adam Wainwright',
   'Paul Goldschmidt', 'Matt Carpenter', 'Josh Donaldson', 'Clayton Kershaw', 'Walker Buehler', 'Chase Anderson',
   'Brady Singer', 'Hunter Pence', 'Kevin Pillar', 'Garrett Richards', 'Brandon Morrow', 'Trevor Bauer', 'Aaron Boone'
  ].forEach(function (n) { BLOCK[n] = true; });

  function pick(rng, a) { return a[Math.floor(rng.u() * a.length)]; }
  function person(rng) {
    for (;;) {
      var o = ORIGINS[rng.pickW(ORIGINS.map(function (x) { return x.w; }))];
      var p = { first: pick(rng, o.first), last: pick(rng, o.last), origin: o.key };
      if (!BLOCK[p.first + ' ' + p.last] && p.first !== p.last) return p;   // and never 'Brooks Brooks' (a few names are in both pools)
    }
  }
  function fullName(p) { return p.first + ' ' + p.last; }
  // two teams that do not share a city or a nickname
  function teams(rng) {
    var c1 = pick(rng, CITIES), c2;
    do { c2 = pick(rng, CITIES); } while (c2 === c1);
    var n1 = pick(rng, NICKS), n2;
    do { n2 = pick(rng, NICKS); } while (n2 === n1);
    return [{ city: c1, nick: n1 }, { city: c2, nick: n2 }];
  }
  function park(rng) { return pick(rng, PARK_A) + ' ' + pick(rng, PARK_B); }
  // A league of nOrg organisations: each a major-league club (a big city, a compelling name) and one club at each of
  // the five levels below (small cities, obscure names). Every city once; a nickname once per level, and once in the
  // whole league while the list lasts.
  function league(rng, nOrg) {
    function deal(list, n) { var a = list.slice(), out = []; for (var i = 0; i < n; i++) { if (!a.length) a = list.slice(); out.push(a.splice(Math.floor(rng.u() * a.length), 1)[0]); } return out; }
    var mc = deal(MAJOR_CITIES, nOrg), mn = deal(MAJOR_NICKS, nOrg), lc = deal(MINOR_CITIES, 5 * nOrg), pool = MINOR_NICKS.slice(), orgs = [];
    var levelNicks = [];
    for (var lv = 0; lv < 5; lv++) {   // nicknames: unique within a level, drawn from what the league has not used yet
      var row = [];
      for (var k = 0; k < nOrg; k++) {
        var avail = pool.filter(function (x) { return row.indexOf(x) < 0; }); if (!avail.length) { pool = MINOR_NICKS.slice(); avail = pool.filter(function (x) { return row.indexOf(x) < 0; }); }
        var nk = avail[Math.floor(rng.u() * avail.length)]; row.push(nk); pool.splice(pool.indexOf(nk), 1);
      }
      levelNicks.push(row);
    }
    for (var o = 0; o < nOrg; o++) orgs.push({ teams: [{ city: mc[o], nick: mn[o] }].concat([0, 1, 2, 3, 4].map(function (lv) { return { city: lc[o * 5 + lv], nick: levelNicks[lv][o] }; })) });
    return orgs;
  }

  return { person: person, fullName: fullName, teams: teams, park: park, league: league };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BBNames;
