const express = require("express"); // Importamos el framework Express para crear el servidor
const fs = require("fs"); // Importamos el módulo File System para leer/escribir archivos
const Joi = require("joi");
const app = express(); // Inicializamos la aplicación de Express
const path = require('path');
app.use(express.json());
// Definimos el esquema de validación
const pokemonSchema = Joi.object({
  nombre: Joi.string().required(),
  tipo: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .required(),
  vida: Joi.number().integer().min(1).required(),
  defensa: Joi.number().integer().min(0).required(),
  ataques: Joi.array()
    .items(
      Joi.object({
        nombre: Joi.string().required(),
        potencia: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(), // Al menos debe tener un ataque
});
const combateSchema = Joi.object({
  id: Joi.number().integer().required(),
  pokemon1: Joi.object({
    nombre: Joi.string().required(),
    vida: Joi.number().integer().min(0).required()
  }).required(),
  pokemon2: Joi.object({
    nombre: Joi.string().required(),
    vida: Joi.number().integer().min(0).required()
  }).required(),
  turno: Joi.number().integer().min(1).default(1),
  ganador: Joi.string().allow(null).default(null)
});
const combates = [
  {
    id: 1,
    pokemon1: {
      nombre: "Pikachu",
      vida: 100,
    },
    pokemon2: {
      nombre: "Charmander",
      vida: 100,
    },
    turno: 1,
    ganador: null,
  },
  {
    id: 2,
    pokemon1: {
      nombre: "squirtle",
      vida: 100,
    },
    pokemon2: {
      nombre: "bulbasur",
      vida: 100,
    },
    turno: 1,
    ganador: null,
  },
];
// Definimos una función para leer el archivo y evitar repetir código
const leerPokemons = () => {
  // Leemos el archivo físico. 'utf-8' es para que lo lea como texto y no como datos binarios
  const data = fs.readFileSync("./pokemons.json", "utf-8");
  // Convertimos el texto del archivo en un objeto JS y devolvemos solo el array "items"
  return JSON.parse(data);
};

app.get("/pokemon/lista", (req, res) => {
  const pokemons = leerPokemons(); // Ejecutamos la función de arriba para tener el array actualizado
  res.json(pokemons);
});
app.get("/combate/lista", (req, res) => {
    res.status(200).json(combates);
})
app.get("/combate/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const combate = combates.find((c) => c.id === id);
  if (combate) {
    res.status(200).json(combate);
  } else {
    res.status(404).json({ error: "Combate no encontrado" });
  }
});
// Implementación en el método POST
app.post("/pokemon/nuevo", (req, res) => {
  const dataCompleta = JSON.parse(fs.readFileSync("./Pokemons.json", "utf-8"));
  const { error, value } = pokemonSchema.validate(req.body);

  if (error) {
    // Si hay error, devolvemos un 400 con el detalle
    return res.status(400).json({
      mensaje: "Datos del Pokémon inválidos",
      detalles: error.details.map((d) => d.message),
    });
  }

  // Si pasa la validación, "value" contiene los datos limpios
  const nuevoPokemon = value;
  console.log("Creando a:", nuevoPokemon.nombre);
  dataCompleta.push(nuevoPokemon);
  fs.writeFileSync("./Pokemons.json", JSON.stringify(dataCompleta, null, 2));
  res
    .status(200)
    .json({ mensaje: "Pokémon creado con éxito", data: nuevoPokemon });
});
app.post('/combate/nuevo', (req, res) => {
  const { pokemon1, pokemon2 } = req.body;

  try {
    // 1. Asegúrate de que el nombre del archivo sea EXACTAMENTE Pokemons.json (con la P mayúscula)
    const data = fs.readFileSync(path.join(__dirname, 'Pokemons.json'), 'utf8');
    const listaPokemons = JSON.parse(data);

    const p1Data = listaPokemons.find(p => p.nombre.toLowerCase() === pokemon1?.toLowerCase());
    const p2Data = listaPokemons.find(p => p.nombre.toLowerCase() === pokemon2?.toLowerCase());

    if (!p1Data || !p2Data) {
      return res.status(400).send("Uno de los pokémon no existe");
    }

 const nuevoCombate = {
  id: combates.length + 1,
  // Ahora guardamos también los ataques
  pokemon1: { ...p1Data }, 
  pokemon2: { ...p2Data },
  turno: 1,
  ganador: null
};


    combates.push(nuevoCombate);
    res.status(200).json({ combate: nuevoCombate.id });

  } catch (err) {
    // ESTO ES CLAVE: Mira la terminal de VS Code cuando mandes la petición
    console.log("EL ERROR REAL ES:", err); 
    res.status(500).send("Error en el servidor");
  }
});
app.post("/combate/ataque", (req, res) => {
  const { id, ataque } = req.body;

  // 1. Buscar el combate en tu array de combates
  const combate = combates.find((c) => c.id === Number(id));
  if (!combate) return res.status(400).send("El combate no existe");

  // 2. Identificar el nombre del Pokémon que ataca según el turno
  const nombreAtacante = combate.turno === 1 ? combate.pokemon1.nombre : combate.pokemon2.nombre;

  // 3. LEER EL JSON de Pokémon para obtener los ataques (ya que no están en el combate)
  const listaPokemons = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pokemons.json'), 'utf8'));
  
  // 4. Buscar los datos completos del Pokémon atacante en el JSON
  const datosCompletosAtacante = listaPokemons.find(
    (p) => p.nombre.toLowerCase() === nombreAtacante.toLowerCase()
  );

  // 5. Buscar el ataque dentro de los datos del JSON
  const ataqueEncontrado = datosCompletosAtacante?.ataques.find(
    (a) => a.nombre.toLowerCase() === ataque?.toLowerCase()
  );

  if (!ataqueEncontrado) {
    return res.status(400).send("El ataque no existe");
  }

  // 6. Lógica de daño (ejemplo: potencia / 2)
  const danio = ataqueEncontrado.potencia / 2;
  
  // 7. Aplicar daño al defensor en el objeto 'combate'
  if (combate.turno === 1) {
    combate.pokemon2.vida -= danio;
  } else {
    combate.pokemon1.vida -= danio;
  }

  // 8. Cambiar turno
  combate.turno = combate.turno === 1 ? 2 : 1;

  // 9. Respuesta
  res.status(200).json({ "golpe": parseFloat(danio.toFixed(3)) });
});
app.post("/combate/borrar", (req, res) => {
  const { id } = req.body;

  // 1. Buscamos el índice del combate en el array
  const index = combates.findIndex((c) => c.id === Number(id));

  // 2. Si el índice es -1, significa que no existe
  if (index === -1) {
    return res.status(400).send("El combate no existe");
  }

  // 3. Borramos el combate del array usando su posición
  combates.splice(index, 1);

  // 4. Respondemos según el enunciado
  res.status(200).json({ "status": "ok" });
});



// Ponemos el servidor en marcha en el puerto 3000
app.listen(3000, () =>
  console.log("Servidor escuchando en puerto  http://localhost:3000"),
);
