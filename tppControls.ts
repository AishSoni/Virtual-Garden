import * as tjs from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { A, D, DIRECTIONS, S, W } from './controlUtil';


export const ratio = 1;

export class CharacterControls {

    model: tjs.Group;
    mixer: tjs.AnimationMixer;
    animationsMap: Map<string, tjs.AnimationAction> = new Map(); // Walk, Run, Idle
    orbitControl: OrbitControls;
    camera: tjs.Camera;

    // state
    toggleRun: boolean = true;
    currentAction: string;
    
    // temporary data
    walkDirection = new tjs.Vector3();
    rotateAngle = new tjs.Vector3(0, 1, 0);
    rotateQuarternion: tjs.Quaternion = new tjs.Quaternion();
    cameraTarget = new tjs.Vector3();
    
    // constants
    fadeDuration: number = 0.2;
    runVelocity: number = 2 * ratio;
    walkVelocity: number = 1.4 * ratio;
    downVector: tjs.Vector3;

    constructor(model: tjs.Group,
        mixer: tjs.AnimationMixer, animationsMap: Map<string, tjs.AnimationAction>,
        orbitControl: OrbitControls, camera: tjs.Camera,
        currentAction: string) {
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;
        this.animationsMap.forEach((value, key) => {
            if (key == currentAction)
                value.play();
        })
        this.orbitControl = orbitControl;
        this.camera = camera;
        this.downVector = new tjs.Vector3(0, -1, 0);
        this.updateCameraTarget(0,0);
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun;
    }

    public update(delta: number, keysPressed: any, raycaster: tjs.Raycaster, ground: tjs.Group) {
        const directionPressed = DIRECTIONS.some(key => keysPressed[key] == true);

        var play = '';
        if (directionPressed && this.toggleRun) {
            play = 'Run';
        } else if (directionPressed) {
            play = 'Walk';
        } else {
            play = 'Idle';
        }

        if (this.currentAction != play) {
            const toPlay = this.animationsMap.get(play);
            const current = this.animationsMap.get(this.currentAction);

            current!.fadeOut(this.fadeDuration);
            toPlay!.reset().fadeIn(this.fadeDuration).play();

            this.currentAction = play;
        }

        this.mixer.update(delta);

        if (this.currentAction == 'Run' || this.currentAction == 'Walk') {
            // calculate towards camera direction
            var angleYCameraDirection = Math.atan2(
                    (this.camera.position.x - this.model.position.x), 
                    (this.camera.position.z - this.model.position.z));
            // diagonal movement angle offset
            var directionOffset = this.directionOffset(keysPressed);

            // rotate model
            this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset);
            this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2);

            // calculate direction
            this.camera.getWorldDirection(this.walkDirection);
            this.walkDirection.y = 0;
            this.walkDirection.normalize();
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

            // account for collisions
            if (!this.detectCollision(raycaster, ground)) {
                this.model.position.add(this.walkDirection);
            }

            const rayOrigin = this.model.position.clone();
            rayOrigin.y += 10;
            raycaster.set(rayOrigin, this.downVector);
            const intersects = raycaster.intersectObject(ground, true);

            if (intersects.length > 0) {
                const targetY = intersects[0].point.y + 1;
                this.model.position.y = targetY;
            }

            // run/walk velocity
            const velocity = this.currentAction == 'Run' ? this.runVelocity : this.walkVelocity;

            // move model & camera
            const moveX = this.walkDirection.x * velocity * delta;
            const moveZ = this.walkDirection.z * velocity * delta;
            this.model.position.x += moveX;
            this.model.position.z += moveZ;
            this.updateCameraTarget(moveX, moveZ);
        }
    }

    private updateCameraTarget(moveX: number, moveZ: number) {
        // move camera
        this.camera.position.x += moveX;
        this.camera.position.z += moveZ;

        // update camera target
        this.cameraTarget.x = this.model.position.x;
        this.cameraTarget.y = this.model.position.y + 1;
        this.cameraTarget.z = this.model.position.z;
        this.orbitControl.target = this.cameraTarget;
    }

    private directionOffset(keysPressed: any) {
        var directionOffset = 0; // w

        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4; // w+a
            } else if (keysPressed[D]) {
                directionOffset = - Math.PI / 4; // w+d
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
            } else {
                directionOffset = Math.PI; // s
            }
        } else if (keysPressed[A]) {
            directionOffset = Math.PI / 2; // a
        } else if (keysPressed[D]) {
            directionOffset = - Math.PI / 2; // d
        }

        return directionOffset;
    }

    //Ground Collision Detection
    private detectCollision(raycaster: tjs.Raycaster, ground: any) {
        const c_size = 1.68;
        const collisionRaycasters = new Array<tjs.Raycaster>();
        const rayLength = c_size * 0.5;

        const offsets = [
            new tjs.Vector3(c_size / 2, c_size / 2, 0),  // Right
            new tjs.Vector3(-c_size / 2, c_size / 2, 0), // Left
            new tjs.Vector3(0, c_size / 2, c_size / 2),  // Front
            new tjs.Vector3(0, c_size / 2, -c_size / 2)  // Back
        ];

        const rayDirection = this.walkDirection.clone().normalize();

        for (let i = 0; i < offsets.length; i++) {
            const rayOrigin = this.model.position.clone().add(offsets[i]);
            const raycaster = new tjs.Raycaster(rayOrigin, rayDirection);
            collisionRaycasters.push(raycaster);
        }

        for (let i = 0; i < collisionRaycasters.length; i++) {
            const intersects = collisionRaycasters[i].intersectObject(ground, true);
            if (intersects.length > 0 && intersects[0].distance < rayLength) {
                return true;
            }
        }

        return false;
    }
};