export class Buff {
    constructor(name, effectType, value, rounds, targets =[]) {
        this.name = name;
        this.effectType = effectType;
        this.value = value;
        this.rounds = rounds;
        this.targets = targets;
    }

    applyEffect() {
        if (this.rounds <= 0) return;
        this.targets.forEach(target => {
            switch (this.effectType) {
                case 'incAtk':
                    target.atk += this.value;
                    break;
                case 'incDef':
                    target.def += this.value;
                    break;
                case 'heal':
                    target.onHeal(this.value);
                    break;
            }
        });
        this.rounds--;
    }
}

export class Skill {
    constructor(name, effectType, value) {
        this.name = name;
        this.effectType = effectType;
        this.value = value;
    }

    applyEffect(user, target) {
        switch (this.effectType) {
            case 'damage':
                target.onDamage(user, this.value);
                break;
            case 'heal':
                target.onHeal(this.value);
                break;
            case 'incAtk':
                target.atk += this.value;
                break;
            case 'incDef':
                target.def += this.value;
                break;
            case 'speedUp':
                // speedUp(this.value);
                break;
            case 'forwardAction':
                // actionForward(this.value);
                break;
            default:
                console.error('Invalid skill effect type!');
        }
    }
}

class Character {
    constructor(id, name, lv, hp, atk, def, crit_rate, crit_dmg, speed) {
        this.id = id;
        this.name = name;
        this.lv = lv;
        this.hp = hp;
        this.maxHp = hp;
        this.atk = atk;
        this.def = def;
        this.crit_rate = crit_rate;
        this.crit_dmg = crit_dmg;
        this.speed = speed;
        this.dmg_inc = 0;
        this.isAlive = true;
    }

    onDamage(attacker, rate) {
        if (!this.isAlive) {
            console.error(`Character ${this.id}: ${this.name} is already dead!`);
            return;
        }
        let dmg = 0;
        // Check for critical hit
        if (Math.random() <= attacker.crit_rate)
            dmg = attacker.atk * attacker.crit_dmg;
        else
            dmg = attacker.atk;

        // Check for attack rate
        dmg *= rate;

        // Check for dmg increase
        dmg *= (1 + attacker.dmg_inc);

        // Check for defense
        dmg *= (attacker.atk) / (attacker.atk + this.def);
        dmg = Math.floor(dmg);

        this.onLoseHp(dmg);
    }

    onLoseHp(amount) {
        if (!this.isAlive) {
            console.error(`Character ${this.id}: ${this.name} is already dead!`);
            return;
        }
        this.hp -= amount;
        console.log(`Character ${this.id}: ${this.name} took ${amount} damage!`);
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            console.log(`Character ${this.id}: ${this.name} is dead!`);
        }
    }

    onHeal(amount) {
        if (!this.isAlive) {
            console.error(`Character ${this.id}: ${this.name} is dead and cannot be healed!`);
            return;
        }
        this.hp += amount;
        this.hp = Math.min(this.hp, this.maxHp);
        console.log(`Character ${this.id}: ${this.name} healed for ${amount}!`);
    }
}

export class Player extends Character {
    constructor(id, name, lv, hp, atk, def, crit_rate, crit_dmg, speed, skills = []) {
        super(id, name, lv, hp, atk, def, crit_rate, crit_dmg, speed);
        this.skills = skills;
    }

    useSkill(id, target) {
        if (!this.isAlive) {
            console.error(`Character ${this.id}: ${this.name} is dead and cannot use skill!`);
            return;
        }
        const skill = this.skills[id];
        console.log(`Character ${this.id}: ${this.name} is using skill ${skill.name} on ${target.name}!`);
        skill.applyEffect(this, target);
    }
}

export class Enemy extends Character {
    constructor(id, name, lv, hp, atk, def, crit_rate, crit_dmg, speed, skills = []) {
        super(id, name, lv, hp, atk, def, crit_rate, crit_dmg, speed);
        this.skills = skills;
    }

    useSkill(id, target) {
        if (!this.isAlive) {
            console.error(`Character ${this.id}: ${this.name} is dead and cannot use skill!`);
            return;
        }
        const skill = this.skills[id];
        console.log(`Character ${this.id}: ${this.name} is using skill ${skill.name} on ${target.name}!`);
        skill.applyEffect(this, target);
    }
}