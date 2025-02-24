// Configuração inicial do jogo usando Phaser com o sistema de física Matter
const config = {
  type: Phaser.AUTO, // Seleciona automaticamente entre WebGL e Canvas
  width: window.innerWidth, // Largura do jogo igual à largura da janela do navegador
  height: window.innerHeight, // Altura do jogo igual à altura da janela do navegador
  physics: {
    default: "matter", // Utiliza o sistema de física Matter
    matter: {
      debug: false // Desativa o modo de depuração da física
    }
  },
  scene: [
    {
      preload: preload, // Função para carregar os assets
      create: create,   // Função para criar e posicionar os objetos do jogo
      update: update    // Função para atualizar a lógica a cada frame
    }
  ]
};

// Inicializa o jogo com as configurações definidas
const game = new Phaser.Game(config);

// Variáveis globais para gerenciar o item coletável "team" e os espinhos
let team;
let spikes = [];

// Função responsável por carregar os recursos (imagens, mapas, animações) antes do início do jogo
function preload() {
  // Carrega o atlas do personagem com suas imagens e dados de animação
  this.load.atlas('chris', '../assets/chris/chris.png', '../assets/chris/chris.json');
  // Carrega a imagem de fundo
  this.load.image('background', '../assets/sheets/Background/Gray.png');
  // Carrega a imagem do terreno
  this.load.image('fase', '../assets/sheets/Terrain/Terrain (16x16).png');
  // Carrega o arquivo JSON do mapa de tiles
  this.load.tilemapTiledJSON('tilefase', '../assets/sheets/Terrain/fase.json');

  // Carrega os assets dos itens interativos:
  // "team" é o item coletável que concede uma habilidade
  this.load.image('team', '../assets/sheets/Items/Fruits/team.png');
  // "chegada" representa a linha de chegada
  this.load.image('chegada', '../assets/sheets/Items/Fruits/chegada.png');
  // "spikes" são os obstáculos que causam a "morte" do personagem
  this.load.image('spikes', '../assets/sheets/Traps/Spikes/Idle.png');
}

// Função que cria os elementos do jogo e define suas propriedades
function create() {
  // Define as animações do personagem (idle, andando e pulo)
  this.animacao = () => {
    this.anims.create({
      key: 'idle',
      frames: [{ key: 'chris', frame: 'respirando1.png' }]
    });
    this.anims.create({
      key: 'andando',
      frameRate: 10,
      frames: this.anims.generateFrameNames('chris', { start: 1, end: 2, prefix: 'andada', suffix: '.png' }),
      repeat: -1
    });
    this.anims.create({
      key: 'pulo',
      frameRate: 10,
      frames: this.anims.generateFrameNames('chris', { start: 0, end: 8, prefix: 'pulo', suffix: '.png' }),
      repeat: -1
    });
  };
  this.animacao();

  // Cria o mapa de tiles a partir do JSON carregado
  const map = this.make.tilemap({ key: 'tilefase' });
  // Adiciona as imagens dos tilesets ao mapa
  const tileset = map.addTilesetImage('fase1', 'fase');
  const bg = map.addTilesetImage('bg', 'background');
  const spikes0 = map.addTilesetImage('spikes', 'spikes');

  // Cria as camadas do mapa (fundo, chão e espinhos)
  map.createLayer('bg', bg);
  const chao = map.createLayer('fase1', tileset);
  map.createLayer('spikes', spikes0);

  // Cria a camada de paredes, configura colisões e converte para corpos físicos
  const paredes = map.createLayer('paredes', tileset);
  paredes.setCollisionByProperty({ collides: true });
  this.matter.world.convertTilemapLayer(paredes);

  // Configura colisões para a camada do chão e converte para corpos físicos
  chao.setCollisionByProperty({ collides: true });
  this.matter.world.convertTilemapLayer(chao);

  // Adiciona o personagem principal à cena com escala reduzida e rotação fixa
  this.chris = this.matter.add.sprite(60, 500, 'chris').setScale(0.25).setFixedRotation();
  // Inicia a animação de pulo para o personagem
  this.chris.play('pulo', true);

  // Captura as teclas de seta para controlar o personagem
  this.cursors = this.input.keyboard.createCursorKeys();

  // Obtém a camada de objetos do mapa para posicionar itens interativos
  const objectsLayer = map.getObjectLayer('objects');
  let teamPos = { x: 0, y: 0 };
  let chegadaPos = { x: 0, y: 0 };

  // Itera pelos objetos definidos no mapa e os adiciona à cena
  objectsLayer.objects.forEach(objData => {
    const { x = 0, y = 0, name, width = 0, height = 0 } = objData;

    // Se o objeto for o item "team", cria-o como um objeto estático e sensor
    if (name === 'team') {
      teamPos = { x, y };
      team = this.matter.add.sprite(x, y, 'team', undefined, {
        isStatic: true,
        isSensor: true
      }).setScale(0.1);
    }

    // Se o objeto for a "chegada", cria-o como sensor para indicar o fim da fase
    if (name === 'chegada') {
      chegadaPos = { x, y };
      chegada = this.matter.add.sprite(x, y, 'chegada', undefined, {
        isStatic: true,
        isSensor: true
      }).setScale(0.1);
    }

    // Se o objeto for um conjunto de "spikes", cria um retângulo físico e adiciona ao array de espinhos
    if (name === 'spikes') {
      let spike = this.matter.add.rectangle(
        x + (width * 0.5),
        y + (height * 0.5),
        width,
        height,
        {
          isStatic: true,
          isSensor: true
        }
      );
      spikes.push(spike);
    }
  });

  // Registra um evento de colisão para detectar interações com os espinhos
  this.matter.world.on(
    "collisionstart",
    function (event) {
      const pairs = event.pairs;
      // Para cada colisão, verifica se o personagem colidiu com um espinho
      pairs.forEach(pair => {
        if (pair.bodyA === this.chris.body) {
          spikes.forEach(spike => {
            if (pair.bodyB === spike) {
              console.log("Chris colidiu com os espinhos! Morreu!");
              morrer(this, teamPos, chegadaPos);
            }
          });
        }
        if (pair.bodyB === this.chris.body) {
          spikes.forEach(spike => {
            if (pair.bodyA === spike) {
              console.log("Chris colidiu com os espinhos! Morreu!");
              morrer(this, teamPos, chegadaPos);
            }
          });
        }
      });
    },
    this
  );
}

// Função que atualiza a lógica do jogo a cada frame
function update() {
  const velocidadeMovimento = 4; // Velocidade horizontal do personagem

  // Movimentação para a esquerda
  if (this.cursors.left.isDown) {
    this.chris.setVelocityX(-velocidadeMovimento);
    this.chris.play("andando", true);
    this.chris.flipX = true;
  }
  // Movimentação para a direita
  else if (this.cursors.right.isDown) {
    this.chris.setVelocityX(velocidadeMovimento);
    this.chris.play("andando", true);
    this.chris.flipX = false;
  }
  // Sem movimento horizontal
  else {
    this.chris.setVelocityX(0);
    this.chris.play("idle", true);
  }

  // Lógica de pulo: se a tecla para cima é pressionada e o personagem está no chão, ele pula
  if (this.cursors.up.isDown && this.chris.body.velocity.y === 0) {
    this.chris.setVelocityY(-8);
  }

  // Enquanto o personagem estiver no ar, a animação de pulo é forçada
  if (this.chris.body.velocity.y !== 0) {
    this.chris.play("pulo", true);
  }

  // Verifica se o personagem coletou o item "team" (baseado na distância)
  if (team) {
    const distancia = Phaser.Math.Distance.Between(this.chris.x, this.chris.y, team.x, team.y);
    const distanciaLimite = 50;
    if (distancia < distanciaLimite) {
      // Exibe uma mensagem informando que a habilidade foi adquirida
      this.resgate = this.add.text(
        100,
        200,
        "Você adquiriu a habilidade de colaborativismo! Corra até a linha de chegada",
        { fontFamily: "Arial", fontSize: 24, color: "#000" }
      );
      // Remove o item "team" da cena para evitar nova coleta
      team.setActive(false);
      team.setVisible(false);
      team.destroy();
      team = null;
    }
  }

  // Verifica se o personagem alcançou a linha de chegada ("chegada")
  if (chegada) {
    const final = Phaser.Math.Distance.Between(this.chris.x, this.chris.y, chegada.x, chegada.y);
    const distanciaLimite2 = 50;
    if (final < distanciaLimite2) {
      chegada.destroy();
      chegada = null;
    }
  }
}

// Função que reinicia a posição do personagem e recria os itens em caso de colisão com espinhos
function morrer(scene, teamPos, chegadaPos) {
  // Reseta a posição e velocidade do personagem
  scene.chris.setPosition(60, 500);
  scene.chris.setVelocity(0, 0);
  // Remove a mensagem de "resgate" se ela estiver ativa
  if (scene.resgate) {
    scene.resgate.destroy();
    scene.resgate = null;
  }
  // Recria o item "team" na posição original
  team = scene.matter.add.sprite(teamPos.x, teamPos.y, "team", undefined, {
    isStatic: true,
    isSensor: true
  }).setScale(0.1);
  // Recria a linha de chegada ("chegada") na posição original
  chegada = scene.matter.add.sprite(chegadaPos.x, chegadaPos.y, "chegada", undefined, {
    isStatic: true,
    isSensor: true
  }).setScale(0.1);
}
