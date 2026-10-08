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
  const data = fs.readFileSync("./Pokemons.json", "utf-8");
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

const p1Data = listaPokemons.find(p => p.nombre.toLowerCase() === pokemon1?.nombre?.toLowerCase());
const p2Data = listaPokemons.find(p => p.nombre.toLowerCase() === pokemon2?.nombre?.toLowerCase());


    if (!p1Data || !p2Data) {
      return res.status(400).send("Uno de los pokémon no existe");
    }

const nuevoCombate = {
  id: combates.length + 1,
  pokemon1: { ...p1Data, vida: 100 }, // Forzamos vida al máximo
  pokemon2: { ...p2Data, vida: 100 },
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

  const combate = combates.find((c) => c.id === Number(id));
  
  // 1. Validaciones de estado
  if (!combate) return res.status(404).send("El combate no existe");
  if (combate.ganador) return res.status(400).send("El combate ya terminó, el ganador fue: " + combate.ganador);

  // 2. Determinar atacante y defensor
  const atacante = combate.turno === 1 ? combate.pokemon1 : combate.pokemon2;
  const defensor = combate.turno === 1 ? combate.pokemon2 : combate.pokemon1;

  // 3. Buscar el ataque (ignoring case)
  // Nota: p1Data y p2Data ya tienen los ataques porque los copiaste en /combate/nuevo
  const ataqueEncontrado = atacante.ataques?.find(
    (a) => a.nombre.toLowerCase() === ataque?.toLowerCase()
  );

  if (!ataqueEncontrado) return res.status(400).send("Ese Pokémon no conoce ese ataque");

  // 4. Lógica de daño corregida
  const danio = ataqueEncontrado.potencia / 2;
  defensor.vida = Math.max(0, defensor.vida - danio); // Evita vida negativa

  // 5. Verificar ganador o cambiar turno
  if (defensor.vida === 0) {
    combate.ganador = atacante.nombre;
  } else {
    combate.turno = combate.turno === 1 ? 2 : 1;
  }

  res.status(200).json({ 
    golpe: danio, 
    vida_restante_rival: defensor.vida,
    ganador: combate.ganador 
  });
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
