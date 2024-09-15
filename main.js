import * as tjs from 'three';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { RGBELoader } from 'three/examples/jsm/Addons.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import * as cannon from 'cannon-es';
import { KeyDisplay } from './controlUtil';
import { CharacterControls } from './tppControls';

//URL Setup
const hdri = new URL('./public/hdri/kloppenheim_02_4k.hdr', import.meta.url);
const testModelURL = new URL('./public/models/test.glb', import.meta.url);
const characterURL = new URL('./public/models/remy.glb', import.meta.url);

//WebGL Renderer Setup
const renderer = new tjs.WebGLRenderer( { antialias: true } );
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = tjs.AgXToneMapping; //AGX Tone Mapping
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = tjs.sRGBEncoding;

//Camera + Control Setup
//Near & Far Values here determine the starting & ending points of view distance, heavily affects performance.
const camera = new tjs.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    300
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true
controls.minDistance = 5
controls.maxDistance = 15
controls.enablePan = false
controls.maxPolarAngle = Math.PI / 2 - 0.05
controls.update();

camera.position.set(8, 5, 3);

var characterControls;
new GLTFLoader()
    .load(characterURL.href, function (gltf) {
        const model = gltf.scene;
        model.traverse(function (object) {
            if (object.isMesh) object.castShadow = true;
        });
        scene.add(model);

        const gltfAnimations = gltf.animations;
        const mixer = new tjs.AnimationMixer(model);
        const animationsMap = new Map();
        gltfAnimations.filter(a => a.name != 'TPose').forEach((a) => {
            animationsMap.set(a.name, mixer.clipAction(a));
        });

        characterControls = new CharacterControls(model, mixer, animationsMap, controls, camera,  'Idle');
    });

const keysPressed = {  }
const keyDisplayQueue = new KeyDisplay();
document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        (keysPressed)[event.key.toLowerCase()] = true
    }
}, false);
document.addEventListener('keyup', (event) => {
    keyDisplayQueue.up(event.key);
    (keysPressed)[event.key.toLowerCase()] = false
}, false);

//Loading Screen Setup
const loadingManager = new tjs.LoadingManager();

loadingManager.onStart = function(url, item, total){
    console.log(`Started Loading: ${url}`);
}

const progressBar = document.getElementById('progress-bar');

loadingManager.onProgress = function(url, loaded, total){
    console.log(`Loading: ${url}`);
    progressBar.value = (loaded / total) * 100;
}

const loadingProgressBar = document.querySelector('.loading-progress-bar');

loadingManager.onLoad = function(){
    console.log(`Finished Loading!`);
    loadingProgressBar.style.display = 'none';
}

loadingManager.onError = function(url){
    console.error(`Error loading: ${url}`);
}

/**
 * Scene Setup
 */
const scene = new tjs.Scene();
const gltfLoader= new GLTFLoader(loadingManager);
const rgbeLoader = new RGBELoader(loadingManager);

scene.fog = new tjs.FogExp2(0xBCC8CC, 0.01); // Squared Exponential Fog

rgbeLoader
    .load(hdri.href, function(texture){
        texture.mapping = tjs.EquirectangularReflectionMapping;

        scene.background = texture;
        scene.environment = texture;

        render();
        //GLTF Models
        gltfLoader
            .load(testModelURL.href, function(gltf){
                gltf.scene.scale.setScalar(0.05);
                scene.add(gltf.scene);
                render();
            }, undefined, function(err){
                console.error(err);
            });
    });

const axes = new tjs.AxesHelper();
scene.add(axes);

const grid = new tjs.GridHelper(20);
scene.add(grid);

const boxGeo = new tjs.BoxGeometry(2, 2, 2);
const boxMat = new tjs.MeshPhysicalMaterial({
    metalness: 1,
    roughness: 0.05
});
const box = new tjs.Mesh(boxGeo, boxMat);
scene.add(box);
box.position.set(8, 8, 3);

const groundGeo = new tjs.PlaneGeometry(200, 200, 10, 10);
const groundMat = new tjs.MeshPhysicalMaterial({
    side: tjs.DoubleSide
});
const ground = new tjs.Mesh(groundGeo, groundMat);
scene.add(ground);

/*
// World / Physics Setup
*/

const world = new cannon.World({
    gravity: new cannon.Vec3(0, -9.80665, 0)
});

const timeStep = 1 / 60;

const groundBody = new cannon.Body({
    shape: new cannon.Plane(),
    mass: 10,
    type: cannon.Body.STATIC
});
world.addBody(groundBody);
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

const boxBody = new cannon.Body({
    mass: 2,
    shape: new cannon.Box(new cannon.Vec3(2, 2, 2)),
    position: new cannon.Vec3(1, 20, 0)
});
world.addBody(boxBody);

//GUI Setup
const params = {
    "bgcol": 0xfefefe
};

const gui = new GUI();
gui.open();

const stats = new Stats();
document.body.appendChild(stats.dom);

//Rendering Setup
function render(){
    renderer.render(scene, camera);
}

//Animation Loop
const clock = new tjs.Clock();
let currentTime;

function animate(){
    currentTime = clock.getDelta();
    world.step(timeStep);

    ground.position.copy(groundBody.position);
    ground.quaternion.copy(groundBody.quaternion);

    box.position.copy(boxBody.position);
    box.quaternion.copy(boxBody.quaternion);

    if(characterControls){
        characterControls.update(currentTime, keysPressed);
    }

    render();
    stats.update();
    controls.update(currentTime);
}

renderer.setAnimationLoop(animate);

//Window Resizing Function
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});