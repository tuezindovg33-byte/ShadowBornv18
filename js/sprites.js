const gravity = 0.2

const floorHeight = 96

// Largura do "mundo" atual — muda de acordo com a fase escolhida
// (ver ASSET/fase em admin.js). Valor inicial é só um placeholder.
let worldWidth = 1024 * 6

// Fase atualmente carregada (ver admin.js: getAllPhases/getPhaseById)
let currentPhase = null
let phaseCompleted = false

// Central de caminhos de imagem: mude aqui se algum arquivo mudar de lugar
const ASSET_PATHS = {
    background: "./assets/background/placeholder.png",
    object: "./assets/objects/square.svg",
    playerIdle: "./assets/player/idle.png",
    playerRunning: "./assets/player/running.png",
    playerJumping: "./assets/player/jumping.png",
    playerAttacking: "./assets/player/attacking.png",
    slash: "./assets/player/slash.png"
}

// Cache de imagens: cada caminho é carregado uma única vez e reaproveitado
// por todos os sprites que usam a mesma imagem.
const IMAGE_CACHE = {}

function getImage(src) {
    let img = IMAGE_CACHE[src]
    if (!img) {
        img = new Image()
        img.src = src
        IMAGE_CACHE[src] = img
    }
    return img
}

// Efeitos visuais ativos (ex: o corte da katana), atualizados/desenhados a cada frame
let activeEffects = []

// Inimigos vivos no mapa
let enemies = []

// Checa sobreposição entre dois retângulos {x, y, width, height}
function rectsOverlap(a, b) {
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
}

// Carrega todas as imagens do jogo ANTES de liberar o botão "Iniciar Jogo".
function waitImage(src){return new Promise((resolve,reject)=>{const img=getImage(src);if(img.complete&&img.naturalWidth){resolve(img);return;}let timer;const cleanup=()=>{clearTimeout(timer);img.removeEventListener('load',loaded);img.removeEventListener('error',failed);};const loaded=()=>{cleanup();resolve(img);};const failed=()=>{cleanup();reject(Error('Imagem não carregou: '+(src.startsWith('data:')?'imagem do Admin':src)));};img.addEventListener('load',loaded);img.addEventListener('error',failed);timer=setTimeout(failed,15000);if(img.complete&&!img.naturalWidth)failed();});}
function preloadCoreImages(){return Promise.all(Object.values(ASSET_PATHS).map(waitImage));}
function preloadPhaseImages(phase,progress=()=>{}){const sources=[];if(phase.bgType==='image')sources.push(phase.bgValue);for(const spawn of phase.spawns||[]){const t=getNpcTypeById(spawn.typeId)||spawn.npcSnapshot;if(t)sources.push(getNpcSpriteSrc(t));}const boss=getNpcTypeById(phase.bossTypeId)||phase.bossSnapshot;if(boss)sources.push(getNpcSpriteSrc(boss));const owned=window.ShadowRaids?.getGuardian().owned[window.ShadowRaids?.getGuardian().equipped];if(owned)sources.push(getNpcSpriteSrc(getNpcTypeById(owned.id)||owned));const unique=[...new Set(sources.filter(Boolean))];let done=0;return Promise.all(unique.map(async src=>{await waitImage(src);progress(++done/unique.length*100);}));}
function preloadImages(){const sources=Object.values(ASSET_PATHS);getAllNpcTypes().forEach(t=>sources.push(getNpcSpriteSrc(t)));getAllPhases().forEach(p=>{if(p.bgType==='image')sources.push(p.bgValue);});return Promise.allSettled([...new Set(sources)].map(waitImage));}

class Sprite {
    constructor({ position, velocity, source, scale, offset, sprites }) {
        this.position = position
        this.velocity = velocity

        this.scale = scale || 1

        const src = source || ASSET_PATHS.object
        this.image = getImage(src)
        this.width = this.image.width * this.scale
        this.height = this.image.height * this.scale

        // Se a imagem ainda não carregou (ex: instância criada antes do
        // pré-carregamento terminar), corrige width/height assim que carregar.
        if (!this.image.complete) {
            this.image.addEventListener('load', () => {
                this.width = this.image.width * this.scale
                this.height = this.image.height * this.scale
            }, { once: true })
        }

        this.offset = offset || {
            x: 0,
            y: 0
        }

        this.sprites = sprites || {
            idle: {
                src: src,
                totalSpriteFrames: 1,
                framesPerSpriteFrame: 1
            }
        }

        this.currentSprite = this.sprites.idle

        this.currentSpriteFrame = 0
        this.elapsedTime = 0
        this.totalSpriteFrames = this.sprites.idle.totalSpriteFrames
        this.framesPerSpriteFrame = this.sprites.idle.framesPerSpriteFrame
    }

    setSprite(sprite) {
        this.currentSprite = this.sprites[sprite]

        if (!this.currentSprite) {
            this.currentSprite = this.sprites.idle
        }
    }

    loadSprite() {
        const newSrc = this.currentSprite.src
        const newImage = getImage(newSrc)

        // Só troca (e corrige a posição) quando a imagem realmente muda
        if (newImage !== this.image) {
            const previousHeight = this.height
            this.image = newImage

            const applyDimensions = () => {
                this.width = this.image.width * this.scale
                this.height = this.image.height * this.scale
                // Corrige a posição para os "pés" continuarem no mesmo lugar
                // ao trocar entre sprites com alturas diferentes
                this.position.y += previousHeight - this.height
            }

            if (this.image.complete) {
                applyDimensions()
            } else {
                this.image.addEventListener('load', applyDimensions, { once: true })
            }
        }

        this.totalSpriteFrames = this.currentSprite.totalSpriteFrames
        this.framesPerSpriteFrame = this.currentSprite.framesPerSpriteFrame
    }

    draw() {
        if (!this.image.complete || this.image.naturalWidth === 0) return

        ctx.imageSmoothingEnabled = false;

        // Determine the x-scale based on the facing direction
        const xScale = (this.facing||"right") === (this.type?.spriteFacing || "right") ? 1 : -1;

        ctx.save();
        if (this.visualHue) ctx.filter = `hue-rotate(${this.visualHue}deg)`;
        ctx.translate(this.position.x + this.offset.x, this.position.y + this.offset.y);
        ctx.scale(xScale, 1); // Flip the image horizontally if facing left

        ctx.drawImage(
            this.image,
            this.currentSpriteFrame * this.image.width / this.totalSpriteFrames,
            0,
            this.image.width / this.totalSpriteFrames,
            this.image.height,
            0,
            0,
            this.width / this.totalSpriteFrames * xScale, // Adjust the width with x-scale
            this.height
        );

        ctx.restore();
    }

    animate() {
        this.elapsedTime += 1

        if (this.elapsedTime >= this.framesPerSpriteFrame) {
            this.currentSpriteFrame += 1

            if (this.currentSpriteFrame >= this.totalSpriteFrames) {
                this.currentSpriteFrame = 0
            }

            this.elapsedTime = 0
        }

    }

    update() {
        this.draw()
        this.animate()
    }
}

// Efeito visual do corte da katana (usa assets/player/slash.png, 5 quadros)
class SlashEffect extends Sprite {
    constructor({ position, facing, scale, effectSrc, effectFrames }) {
        super({
            position,
            velocity: { x: 0, y: 0 },
            scale: scale || 3,
            source: effectSrc || ASSET_PATHS.slash,
            sprites: {
                idle: {
                    src: effectSrc || ASSET_PATHS.slash,
                    totalSpriteFrames: effectFrames || 5,
                    framesPerSpriteFrame: 3
                }
            }
        })

        this.facing = facing
        this.markedForRemoval = false
    }

    animate() {
        // Detecta quando o último quadro terminou de ser exibido,
        // para remover o efeito assim que a animação acabar (sem repetir em loop)
        const isLastFrame = this.currentSpriteFrame === this.totalSpriteFrames - 1
        const aboutToWrap = this.elapsedTime + 1 >= this.framesPerSpriteFrame

        super.animate()

        if (isLastFrame && aboutToWrap) {
            this.markedForRemoval = true
        }
    }
}

function spawnSlashEffect(fighter) {
    const facing = fighter.facing === "left" ? "left" : "right"

    // fighter.width é a largura da spritesheet inteira (todos os quadros
    // somados) — precisamos da largura de UM quadro para posicionar o corte
    // corretamente na frente do personagem.
    const frameWidth = fighter.width / fighter.totalSpriteFrames
    const forwardOffset = facing === "left" ? -(frameWidth * 0.55) : frameWidth * 0.55

    const slash = new SlashEffect({
        position: {
            x: fighter.position.x + forwardOffset,
            y: fighter.position.y + fighter.height * 0.32
        },
        facing,
        effectSrc: window.ShadowEquipment?.attackGear()?.effectSprite,
        effectFrames: window.ShadowEquipment?.attackGear()?.effectFrames || 5
    })

    slash.position = {x:getAttackHitbox(fighter).x,y:getAttackHitbox(fighter).y};
    slash.cutStyle = {...(window.ShadowEquipment?.attackGear()||{})};
    slash.launchedAt = fighter.hitboxStartedAt;
    slash.attackRange = Number(slash.cutStyle.attackRange)||150;
    slash.framesPerSpriteFrame = Math.max(1,Math.round(5/(Number(slash.cutStyle.effectSpeed)||1)));
    activeEffects.push(slash)
}

// Área que realmente causa dano durante um golpe (fica ativa por pouco tempo)
function getAttackHitbox(fighter) {
    const frameWidth = fighter.width / fighter.totalSpriteFrames
    const width = Number(window.ShadowEquipment?.attackGear()?.attackRange)||150
    const height = 80

    const travel = fighter.isAttacking ? Math.min(1,Math.max(0,(performance.now()-(fighter.hitboxStartedAt||performance.now()))/200))*40 : 0;
    const x = fighter.facing === "left"
        ? fighter.position.x - width + frameWidth * 0.4 - travel
        : fighter.position.x + frameWidth * 0.4 + travel

    const y = fighter.position.y + fighter.height * 0.12

    return { x, y, width, height }
}

// NPC inimigo: anda de um lado para o outro, tem vida, e pode ser morto pelo jogador.
// `type` vem de admin.js (getNpcTypeById) — padrão ou criado no editor de pixel art.
class Enemy extends Sprite {
    constructor({ position, patrolRange, type }) {
        super({
            position,
            velocity: { x: 0, y: 0 },
            scale: type.scale || 1.8,
            source: getNpcSpriteSrc(type)
        })

        // Imagens próprias seguem a mesma altura base dos sprites de 64px.
        if (type.imageUrl) {
            const targetHeight = 64 * (type.scale || 1.8);
            const fitImage = () => {
                if (!this.image.naturalHeight) return;
                this.scale = targetHeight / this.image.naturalHeight;
                this.width = this.image.naturalWidth * this.scale;
                this.height = targetHeight;
                this.position.y = canvas.height - floorHeight - this.height;
            };
            if (this.image.complete) fitImage();
            else this.image.addEventListener('load', fitImage, { once:true });
        }

        this.type = type
        this.name = type.name
        this.isBoss = !!type.isBoss

        this.maxHealth = type.health || 30
        this.health = this.maxHealth
        this.contactDamage = type.damage || 8

        this.baseX = position.x
        this.patrolRange = patrolRange || (this.isBoss ? 70 : 90)
        this.speed = type.speed || 0.6
        this.direction = Math.random() < 0.5 ? -1 : 1
        this.facing = this.direction === 1 ? "right" : "left"

        this.isDead = false
        this.deathTimer = 0
        this.markedForRemoval = false

        this.contactCooldown = 0
        this.bobTime = Math.random() * 100
    }

    getBounds() {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.width,
            height: this.height
        }
    }

    takeDamage(amount) {
        if (this.isDead || performance.now() < (this.dodgeUntil||0)) return false
        this.health -= amount
        if (this.health <= 0) {
            this.health = 0
            this.isDead = true
            kills += 1;
            window.ShadowRaids?.onDefeated(this);
            if(typeof updateHud === "function")updateHud();
            this.deathTimer = 30

            const base = this.isBoss ? 60 : 8
            const coinReward = base + Math.floor(Math.random() * 6)
            if (typeof awardCoins === "function") awardCoins(coinReward, this.type)
            if (!window.ShadowRaids?.hasRun() && window.ShadowV9 && typeof window.ShadowV9.rollDrops === "function") window.ShadowV9.rollDrops(this.type)
            if (window.ShadowRPG && typeof window.ShadowRPG.onEnemyDefeated === "function") window.ShadowRPG.onEnemyDefeated(this)
        }
    }

    combatTick() { window.ShadowCombat?.tick(this); }

    patrol() { window.ShadowCombat?.move(this); }

    draw() {
        if (this.isDead) {
            ctx.save()
            ctx.globalAlpha = Math.max(this.deathTimer / 30, 0)
            super.draw()
            ctx.restore()
            return
        }

        super.draw()

        window.ShadowCombat?.draw(this);
        // Barrinha de vida (e nome, se for chefão) acima do inimigo
        const barWidth = this.isBoss ? 70 : 44
        const barX = this.position.x + this.width / 2 - barWidth / 2
        const barY = this.position.y - (this.isBoss ? 22 : 14)

        if (this.isBoss) {
            ctx.fillStyle = "#ffd873"
            ctx.font = "bold 13px 'Trebuchet MS', sans-serif"
            ctx.textAlign = "center"
            ctx.fillText(this.name, this.position.x + this.width / 2, barY - 6)
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
        ctx.fillRect(barX, barY, barWidth, 6)

        ctx.fillStyle = this.isBoss ? "#ffb84d" : "#e74c3c"
        ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), 6)
    }

    update() {
        if (this.isDead) {
            this.deathTimer -= 1
            this.draw()
            if (this.deathTimer <= 0) this.markedForRemoval = true
            return
        }

        if (this.contactCooldown > 0) this.contactCooldown -= 1

        if (performance.now() < (this.burningUntil||0) && performance.now() >= (this.burnTick||0)) {
            this.burnTick = performance.now()+350;
            this.takeDamage(3);
            if(this.isDead)return;
        }
        this.combatTick();
        if(!this.windupUntil)this.patrol()
        this.draw()
        this.animate()
    }
}

function spawnEnemyOfType(typeId, x, snapshot = null) {
    // Primeiro tenta o cadastro atual da planilha; se não existir, usa o snapshot
    // que foi salvo junto com a fase. Isso evita fases quebradas.
    const type = getNpcTypeById(typeId) || snapshot
    if (!type) return null

    const height = 64 * (type.scale || 1.8)
    const groundY = canvas.height - height - floorHeight

    return new Enemy({ position: { x, y: groundY }, type })
}

function spawnEnemies() {
    enemies = []

    if (!currentPhase) return

    currentPhase.spawns.forEach(spawn => {
        const enemy = spawnEnemyOfType(spawn.typeId, spawn.x, spawn.npcSnapshot || null)
        if (enemy) enemies.push(enemy)
    })

    if (currentPhase.bossTypeId) {
        const boss = spawnEnemyOfType(currentPhase.bossTypeId, currentPhase.bossX || (currentPhase.worldWidth - 500), currentPhase.bossSnapshot || null)
        if (boss) enemies.push(boss)
    }
}

class Fighter extends Sprite {
    constructor({
        position,
        velocity,
        attackBox,
        sprites,
        scale
    }) {
        super({
            position,
            velocity,
            scale,
            sprites
        })

        this.velocity = velocity

        this.attackBox = attackBox || {
            position: {
                x: this.position.x,
                y: this.position.y,
            },
            width: 125,
            height: 50
        }

        this.isAttacking
        this.attackCooldown = 500
        this.onAttackCooldown

        this.lastKeyPressed
        this.onGround

        // Combate
        this.health = 100
        this.maxHealth = 100
        this.attackDamage = 15
        this.moveSpeedMultiplier = 1
        this.invulnerable = false
        this.activeHitbox = null
        this.hitboxActiveUntil = 0
        this.hitEnemies = new Set()
    }

    gravity() {
        if (this.position.y + this.height >= canvas.height - floorHeight) {
            this.onGround = true
        } else {
            this.onGround = false
        }

        if (this.position.y + this.height > canvas.height - floorHeight) {
            this.position.y = canvas.height - this.height - floorHeight
            this.velocity.y = 0
        } else {
            if (!this.onGround) this.velocity.y += gravity
        }

        this.position.x += this.velocity.x
        this.position.y += this.velocity.y

        // Impede o jogador de sair dos limites do mapa
        const frameWidth = this.width / this.totalSpriteFrames
        this.position.x = Math.max(0, Math.min(this.position.x, worldWidth - frameWidth))

        this.attackBox.position.x = this.position.x
        this.attackBox.position.y = this.position.y
    }

    update() {
        this.gravity()
        this.loadSprite()
        //this.loadAttackBox()
        this.draw()
        this.animate()
    }

    attack() {
        if (this.onAttackCooldown) return

        this.isAttacking = true
        this.onAttackCooldown = true

        this.setSprite("attacking")
        this.loadSprite() // atualiza width/height imediatamente para o corte nascer no lugar certo
        this.hitboxStartedAt = performance.now();
        spawnSlashEffect(this)

        this.activeHitbox = getAttackHitbox(this)
        this.hitboxActiveUntil = performance.now() + 200
        this.hitEnemies = new Set()

        setTimeout(() => {
            this.isAttacking = false
        }, 400)

        setTimeout(() => {
            this.onAttackCooldown = false
        }, this.attackCooldown)
    }

    takeDamage(amount) {
        if (this.invulnerable) return

        this.health = Math.max(0, this.health - Math.max(1,(window.ShadowRaids?.protect(amount) ?? amount)-(this.defense||0)))
        this.invulnerable = true

        setTimeout(() => {
            this.invulnerable = false
        }, 800)

        if (this.health <= 0 && typeof onPlayerDeath === "function") {
            onPlayerDeath()
        }
    }

    draw() {
        // Pisca enquanto estiver invulnerável (logo após tomar dano)
        if (this.invulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
            ctx.save()
            ctx.globalAlpha = 0.4
            super.draw()
            ctx.restore()
            return
        }

        super.draw()
        window.ShadowEquipment?.drawWeapon(this)
    }

    jump() {
        if (!this.onGround) return
        this.velocity.y = -8.5
    }

}

const player = new Fighter({
    position: {
        x: 100,
        y: 0
    },
    velocity: {
        x: 0,
        y: 10
    },
    scale: 4,
    sprites: {
        idle: {
            src: ASSET_PATHS.playerIdle,
            totalSpriteFrames: 11,
            framesPerSpriteFrame: 18
        },
        running: {
            src: ASSET_PATHS.playerRunning,
            totalSpriteFrames: 10,
            framesPerSpriteFrame: 8
        },
        jumping: {
            src: ASSET_PATHS.playerJumping,
            totalSpriteFrames: 4,
            framesPerSpriteFrame: 8
        },
        attacking: {
            src: ASSET_PATHS.playerAttacking,
            totalSpriteFrames: 7,
            framesPerSpriteFrame: 8
        }
    }
})

/* const player2 = new Fighter({
    position: {
        x: 500,
        y: 20
    },
    velocity: {
        x: 0,
        y: 0
    },
    dimensions: {
        width: 50,
        height: 200
    }
}) */

let kills = 0

function resetGame() {
    if (!currentPhase) currentPhase = getAllPhases()[0]
    worldWidth = currentPhase.worldWidth
    phaseCompleted = false

    player.position = { x: 100, y: 0 }
    player.velocity = { x: 0, y: 10 }
    player.facing = "right"
    player.isAttacking = false
    player.onAttackCooldown = false
    player.invulnerable = false
    player.activeHitbox = null
    player.hitEnemies = new Set()

    if (typeof applyUpgradesToPlayer === "function") {
        applyUpgradesToPlayer(player)
    } else {
        player.health = player.maxHealth
    }

    activeEffects = []
    kills = 0
    spawnEnemies()
    camera.x = 0
}
