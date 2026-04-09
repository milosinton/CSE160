import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

//Picnic Basket by Poly by Google [CC-BY] via Poly Pizza
//Ladybug by Poly by Google [CC-BY] via Poly Pizza
//French Bread by Jarlan Perez [CC-BY] via Poly Pizza
//Apple Half by Kenney
//Cheese by bobbeh [CC-BY] via Poly Pizza
//Chocolate Bar Squares by Jarlan Perez [CC-BY] via Poly Pizza
//Bottle of wine by Poly by Google [CC-BY] via Poly Pizza
//Green Grapes by Jarlan Perez [CC-BY] via Poly Pizza
//Strawberries by Jarlan Perez [CC-BY] via Poly Pizza
//Mouse by Poly by Google [CC-BY] via Poly Pizza
//Cherry by Poly by Google [CC-BY] via Poly Pizza
//Ant by Poly by Google [CC-BY] via Poly Pizza
//Bush by Quaternius

function main() {
	const canvas = document.querySelector('#c');
	const loadingScreen = document.querySelector('#loading-screen');
	const loadingPercent = document.querySelector('#loading-percent');

	const loadingManager = new THREE.LoadingManager();

	loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
		const percent = Math.round((itemsLoaded / itemsTotal) * 100);
		loadingPercent.textContent = `${percent}%`;
	};

	loadingManager.onLoad = async () => {
		await new Promise(requestAnimationFrame);
		loadingScreen.classList.add('hidden');

		setTimeout(() => {
			loadingScreen.style.display = 'none';
		}, 500);
	};

	loadingManager.onError = (url) => {
		console.error('Failed to load:', url);
	};

	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		canvas,
	});
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	const fov = 45;
	const aspect = 2;
	const near = 0.1;
	const far = 1000;
	const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
	camera.position.set(0, 5, 18);
	camera.lookAt(0, 2, 0);

	const scene = new THREE.Scene();

	const textureLoader = new THREE.TextureLoader(loadingManager);
	const exrLoader = new EXRLoader(loadingManager);
	const gltfLoader = new GLTFLoader(loadingManager);

    exrLoader.load('./resources/kloppenheim_06_puresky_4k.exr', (texture) => {
	    texture.mapping = THREE.EquirectangularReflectionMapping;
	    currentSkyTexture = texture;
	    scene.background = texture;
	    scene.environment = texture;
    });

	const controls = new PointerLockControls(camera, document.body);
	scene.add(controls.object);

	document.addEventListener('click', () => {
		if (loadingScreen.style.display !== 'none') return;
		controls.lock();
	});

	const timer = new THREE.Timer();

	// World bounds
	const planeSize = 60;
	const halfPlane = planeSize / 2;
	const boundaryMargin = 1.0;
	const minX = -halfPlane + boundaryMargin;
	const maxX = halfPlane - boundaryMargin;
	const minZ = -halfPlane + boundaryMargin;
	const maxZ = halfPlane - boundaryMargin;

	// Player settings
	const standingEyeHeight = 5;
	const playerRadius = 0.8;
	const gravity = 30;
	const jumpVelocity = 20;

	let playerY = standingEyeHeight;
	let verticalVelocity = 0;
	let isOnGround = true;

	// Movement
	const move = {
		forward: false,
		backward: false,
		left: false,
		right: false,
	};

	const direction = new THREE.Vector3();
	const moveSpeed = 10;

	// Collision data
	const collisionBoxes = [];
	const playerBox = new THREE.Box3();

    const collectibleItems = [];
    let endSequenceStarted = false;
    let ladybugRoot = null;
    let ambientLight;
    let directionalLight;
    let ladybugSpotlight = null;
    let currentSkyTexture = null;
    let pedestalFillLight = null;

	function updatePlayerBox(x, y, z) {
		playerBox.min.set(
			x - playerRadius,
			y - standingEyeHeight,
			z - playerRadius
		);
		playerBox.max.set(
			x + playerRadius,
			y,
			z + playerRadius
		);
	}

	function collidesAt(x, y, z) {
		updatePlayerBox(x, y, z);

		for (const box of collisionBoxes) {
			if (playerBox.intersectsBox(box)) {
				return true;
			}
		}
		return false;
	}

    function registerCollectible(root, shadow, box) {
	collectibleItems.push({
		root,
		shadow,
		box,
		collected: false,
	});
}

function updatePlayerCollectBox() {
	updatePlayerBox(camera.position.x, playerY, camera.position.z);
}

function startLadybugFinale() {
	if (endSequenceStarted) return;
	endSequenceStarted = true;

	// Keep some world lighting
	ambientLight.intensity = 0.12;
	directionalLight.intensity = 0.18;

	// Swap to night sky
	exrLoader.load('./resources/NightSkyHDRI003_4K_HDR.exr', (nightTexture) => {
		nightTexture.mapping = THREE.EquirectangularReflectionMapping;

		if (currentSkyTexture) {
			currentSkyTexture.dispose();
		}

		currentSkyTexture = nightTexture;
		scene.background = nightTexture;
		scene.environment = null;
	});

	// Remove old spotlight if it already exists
	if (ladybugSpotlight) {
		scene.remove(ladybugSpotlight);
		scene.remove(ladybugSpotlight.target);
	}

	// Remove old fill light if it exists
	if (pedestalFillLight) {
		scene.remove(pedestalFillLight);
	}

	// Main spotlight on ladybug
	ladybugSpotlight = new THREE.SpotLight(
		0xfff3b0,
		70,
		24,
		Math.PI / 7,
		0.35,
		2
	);

	ladybugSpotlight.position.set(0, 9, 0);
	ladybugSpotlight.target.position.set(0, pedestalHeight + 0.6, 0);

	scene.add(ladybugSpotlight);
	scene.add(ladybugSpotlight.target);

	if (ladybugRoot) {
		const box = new THREE.Box3().setFromObject(ladybugRoot);
		const center = box.getCenter(new THREE.Vector3());
		ladybugSpotlight.target.position.copy(center);
	}

	// Soft fill light to brighten pedestal top/sides
	pedestalFillLight = new THREE.PointLight(0xffd77a, 28, 16, 2);
	pedestalFillLight.position.set(0, pedestalHeight + 2.2, 0);
	scene.add(pedestalFillLight);

	// Make the pedestal material more readable in the finale
	if (pedestal && pedestal.material) {
		pedestal.material = pedestal.material.clone();
		pedestal.material.metalness = 0.35;
		pedestal.material.roughness = 0.45;
		pedestal.material.clearcoat = 0.15;
		pedestal.material.needsUpdate = true;
	}

	// Ground light pool
	const lightPool = new THREE.Mesh(
		new THREE.CircleGeometry(4.9, 64),
		new THREE.MeshBasicMaterial({
			color: 0xffefaa,
			transparent: true,
			opacity: 0.22,
			depthWrite: false,
		})
	);
	lightPool.rotation.x = -Math.PI / 2;
	lightPool.position.set(0, 0.03, 0);
	scene.add(lightPool);

	const innerLightPool = new THREE.Mesh(
		new THREE.CircleGeometry(3.6, 64),
		new THREE.MeshBasicMaterial({
			color: 0xfff7d6,
			transparent: true,
			opacity: 0.16,
			depthWrite: false,
		})
	);
	innerLightPool.rotation.x = -Math.PI / 2;
	innerLightPool.position.set(0, 0.04, 0);
	scene.add(innerLightPool);

	const ring = new THREE.Mesh(
		new THREE.RingGeometry(4.5, 4.9, 64),
		new THREE.MeshBasicMaterial({
			color: 0xfff1b8,
			transparent: true,
			opacity: 0.28,
			depthWrite: false,
			side: THREE.DoubleSide,
		})
	);
	ring.rotation.x = -Math.PI / 2;
	ring.position.set(0, 0.05, 0);
	scene.add(ring);
}

function checkCollectibles() {
	updatePlayerCollectBox();

	let collectedCount = 0;

	for (const item of collectibleItems) {
		if (!item.collected && playerBox.intersectsBox(item.box)) {
			item.collected = true;
			item.root.visible = false;
			if (item.shadow) item.shadow.visible = false;
		}

		if (item.collected) {
			collectedCount++;
		}
	}

	if (collectibleItems.length > 0 && collectedCount === collectibleItems.length) {
		startLadybugFinale();
	}
}

	document.addEventListener('keydown', (event) => {
		switch (event.code) {
			case 'KeyW':
				move.forward = true;
				break;
			case 'KeyS':
				move.backward = true;
				break;
			case 'KeyA':
				move.left = true;
				break;
			case 'KeyD':
				move.right = true;
				break;
			case 'Space':
				if (isOnGround) {
					verticalVelocity = jumpVelocity;
					isOnGround = false;
				}
				break;
		}
	});

	document.addEventListener('keyup', (event) => {
		switch (event.code) {
			case 'KeyW':
				move.forward = false;
				break;
			case 'KeyS':
				move.backward = false;
				break;
			case 'KeyA':
				move.left = false;
				break;
			case 'KeyD':
				move.right = false;
				break;
		}
	});

	// Ground
	{
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(planeSize, planeSize),
			new THREE.MeshLambertMaterial({ color: 0x2d5016 })
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.01;
		scene.add(ground);
	}

	// Grass
	const grassCount = 15000;
	const grassHeight = 1.3;
	const grassWidth = 0.12;
	const windStrength = 0.1;
	const windSpeed = 0.8;
	const swayAmount = 1.3;

	const grassGeometry = new THREE.PlaneGeometry(grassWidth, grassHeight, 1, 8);
	grassGeometry.translate(0, grassHeight / 2, 0);

	const phases = new Float32Array(grassCount);
	const amplitudes = new Float32Array(grassCount);

	grassGeometry.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
	grassGeometry.setAttribute('amplitude', new THREE.InstancedBufferAttribute(amplitudes, 1));

	const grassMaterial = new THREE.ShaderMaterial({
		vertexShader: `
			attribute float phase;
			attribute float amplitude;

			uniform float time;
			uniform float windStrength;
			uniform float windSpeed;
			uniform float swayAmount;
			uniform float bladeHeight;

			varying float vHeightRatio;

			void main() {
				vHeightRatio = position.y / bladeHeight;
				vec3 pos = position;

				float heightPower = vHeightRatio * vHeightRatio;
				float wave = sin(time * windSpeed + phase) * windStrength * heightPower * amplitude * swayAmount;
				float wave2 = cos(time * windSpeed * 0.7 + phase * 1.3) * windStrength * 0.5 * heightPower * amplitude;

				pos.x += wave;
				pos.z += wave2;

				gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
			}
		`,
		fragmentShader: `
			varying float vHeightRatio;

			void main() {
				vec3 bottomColor = vec3(0.08, 0.28, 0.08);
				vec3 topColor = vec3(0.20, 0.60, 0.16);
				vec3 grassColor = mix(bottomColor, topColor, vHeightRatio);
				gl_FragColor = vec4(grassColor, 1.0);
			}
		`,
		uniforms: {
			time: { value: 0 },
			windStrength: { value: windStrength },
			windSpeed: { value: windSpeed },
			swayAmount: { value: swayAmount },
			bladeHeight: { value: grassHeight },
		},
		side: THREE.DoubleSide,
	});

	const grassField = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
	const dummy = new THREE.Object3D();

	for (let i = 0; i < grassCount; i++) {
		const x = (Math.random() - 0.5) * planeSize;
		const z = (Math.random() - 0.5) * planeSize;
		const scale = 0.85 + Math.random() * 0.35;
		const rotationY = Math.random() * Math.PI * 2;

		dummy.position.set(x, 0, z);
		dummy.rotation.set(0, rotationY, 0);
		dummy.scale.set(scale, scale, scale);
		dummy.updateMatrix();

		grassField.setMatrixAt(i, dummy.matrix);

		phases[i] = Math.random() * Math.PI * 2;
		amplitudes[i] = 0.5 + Math.random() * 0.5;
	}

	grassField.instanceMatrix.needsUpdate = true;
	scene.add(grassField);

	// Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
    directionalLight.position.set(20, 20, 10);
    scene.add(directionalLight);        

	// Gold pedestal
	const pedestalRadius = 4.25;
	const pedestalHeight = 1.6;
	const pedestalTopY = pedestalHeight;

	const goldBaseColor = textureLoader.load('./resources/images/gold/Poliigon_MetalGoldPaint_7253_BaseColor.jpg');
	const goldNormal = textureLoader.load('./resources/images/gold/Poliigon_MetalGoldPaint_7253_Normal.png');
	const goldRoughness = textureLoader.load('./resources/images/gold/Poliigon_MetalGoldPaint_7253_Roughness.jpg');
	const goldMetallic = textureLoader.load('./resources/images/gold/Poliigon_MetalGoldPaint_7253_Metallic.jpg');

	goldBaseColor.colorSpace = THREE.SRGBColorSpace;

	[goldBaseColor, goldNormal, goldRoughness, goldMetallic].forEach((tex) => {
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(2, 1);
	});

	const pedestalMaterial = new THREE.MeshPhysicalMaterial({
		map: goldBaseColor,
		normalMap: goldNormal,
		roughnessMap: goldRoughness,
		metalnessMap: goldMetallic,
		metalness: 1.0,
		roughness: 0.28,
		clearcoat: 0.35,
		clearcoatRoughness: 0.18,
		envMapIntensity: 1.9,
	});

	const pedestalGeometry = new THREE.CylinderGeometry(
		pedestalRadius,
		pedestalRadius,
		pedestalHeight,
		64,
		1,
		false
	);

	const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
	pedestal.position.set(0, pedestalHeight / 2, 0);
	pedestal.receiveShadow = true;
	scene.add(pedestal);

	// Approximate pedestal collision box
	const pedestalCollisionBox = new THREE.Box3(
		new THREE.Vector3(-pedestalRadius, 0, -pedestalRadius),
		new THREE.Vector3(pedestalRadius, pedestalHeight + 3.5, pedestalRadius)
	);
	collisionBoxes.push(pedestalCollisionBox);

	// Ladybug
	gltfLoader.load('./resources/models/Ladybug.glb', (gltf) => {
		const root = gltf.scene;
		scene.add(root);
        ladybugRoot = root;

		const initialBox = new THREE.Box3().setFromObject(root);
		const initialCenter = initialBox.getCenter(new THREE.Vector3());

		root.position.x += (0 - initialCenter.x);
		root.position.z += (0 - initialCenter.z);

		let box = new THREE.Box3().setFromObject(root);
		root.position.y += (0 - box.min.y);

		box = new THREE.Box3().setFromObject(root);
		const size = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const desiredSize = 5;
		const scale = desiredSize / maxDim;
		root.scale.setScalar(scale);

		box = new THREE.Box3().setFromObject(root);
		root.position.y += (pedestalTopY - box.min.y) + 0.03;
		root.rotation.y = Math.PI;

		// Add collision box around ladybug
		const ladybugBox = new THREE.Box3().setFromObject(root);
		ladybugBox.expandByScalar(0.15);
		collisionBoxes.push(ladybugBox);
	});

	// Picnic table
	gltfLoader.load('./resources/models/picnic_table.glb', (gltf) => {
		const root = gltf.scene;
		scene.add(root);

		const box = new THREE.Box3().setFromObject(root);
		const boxCenter = box.getCenter(new THREE.Vector3());

		root.position.x += (0 - boxCenter.x);
		root.position.z += (0 - boxCenter.z);

		const groundedBox = new THREE.Box3().setFromObject(root);
		root.position.y += (0 - groundedBox.min.y);

		const sizeBox = new THREE.Box3().setFromObject(root);
		const size = sizeBox.getSize(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		const desiredSize = 18;
		const scale = desiredSize / maxDim;
		root.scale.setScalar(scale);

		const finalBox = new THREE.Box3().setFromObject(root);
		root.position.y += (0 - finalBox.min.y);

		root.position.set(18, root.position.y, -14);
		root.rotation.y = Math.PI / 2;

        const tableBox = new THREE.Box3().setFromObject(root);
        tableBox.expandByScalar(0.2);
        collisionBoxes.push(tableBox);

    });

	

function resizeRendererToDisplaySize(renderer) {
		const canvas = renderer.domElement;
		const pixelRatio = Math.min(window.devicePixelRatio, 2);
		const width = Math.floor(canvas.clientWidth * pixelRatio);
		const height = Math.floor(canvas.clientHeight * pixelRatio);
		const needResize = canvas.width !== width || canvas.height !== height;

		if (needResize) {
			renderer.setSize(width, height, false);
		}
		return needResize;
	}

// Picnic basket
gltfLoader.load('./resources/models/Picnic Basket.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	// Center basket around itself in X/Z
	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	// Put basket on the ground
	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	// Make basket larger
	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 5.5; // bigger than before
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	// Re-ground after scaling
	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	// Place it on the other side of the ladybug
	// ladybug/pedestal are around (0, 0), so this puts basket to the left side
	root.position.set(-12, root.position.y, -12);

	// Turn it a little so it looks natural
	root.rotation.y = 0.9;

	// Optional collision
	const basketBox = new THREE.Box3().setFromObject(root);
	basketBox.expandByScalar(0.2);
	collisionBoxes.push(basketBox);
});

// French bread
gltfLoader.load('./resources/models/French Bread.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 3.0;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Put bread in place
	const tableTopY = 3.5;
	const breadX = -16;
	const breadZ = 18.0;

	root.position.set(breadX, tableTopY - box.min.y, breadZ);
	root.rotation.y = 0.35;

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.8, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(breadX, 0.03, breadZ);
	shadow.scale.set(1.3, 0.9, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Apple half
gltfLoader.load('./resources/models/Apple Half.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.2;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the bread
	const tableTopY = 3.5;
	const appleX = -3;
	const appleZ = -10;

	root.position.set(appleX, tableTopY - box.min.y, appleZ);
	root.rotation.y = -0.6;

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.4, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(appleX, 0.03, appleZ);
	shadow.scale.set(1.2, 0.85, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Cheese
gltfLoader.load('./resources/models/Cheese.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.4;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the bread/apple
	const tableTopY = 4;
	const cheeseX = -14.2;
	const cheeseZ = 9;

	root.position.set(cheeseX, tableTopY - box.min.y, cheeseZ);
	root.rotation.y = 0.8;

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.3, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(cheeseX, 0.03, cheeseZ);
	shadow.scale.set(1.25, 0.8, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Chocolate bar squares
gltfLoader.load('./resources/models/Chocolate Bar Squares.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.6;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the bread/apple/cheese
	const tableTopY = 3.5;
	const chocolateX = -19;
	const chocolateZ = -13;

	root.position.set(chocolateX, tableTopY - box.min.y, chocolateZ);
	root.rotation.set(-0.35, -0.4 + Math.PI, 0.2);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.35, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(chocolateX, 0.03, chocolateZ);
	shadow.scale.set(1.3, 0.85, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Bottle of wine
gltfLoader.load('./resources/models/Bottle of wine.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 3.8;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the rest of the floating food objects
	const tableTopY = 3.5;
	const bottleX = 12;
	const bottleZ = 19.2;

	root.position.set(bottleX, tableTopY - box.min.y, bottleZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.25, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(bottleX, 0.03, bottleZ);
	shadow.scale.set(1.0, 0.75, 1);
	scene.add(shadow);

	// Optional collision
	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Green grapes
gltfLoader.load('./resources/models/Green Grapes.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.8;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the other floating food objects
	const tableTopY = 3.5;
	const grapesX = 17.2;
	const grapesZ = 11.8;

	root.position.set(grapesX, tableTopY - box.min.y, grapesZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.2, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(grapesX, 0.03, grapesZ);
	shadow.scale.set(1.15, 0.85, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Strawberries
gltfLoader.load('./resources/models/Strawberries.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.6;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the other floating food objects
	const tableTopY = 3.5;
	const strawberriesX = 17;
	const strawberriesZ = 3;

	root.position.set(strawberriesX, tableTopY - box.min.y, strawberriesZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.15, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(strawberriesX, 0.03, strawberriesZ);
	shadow.scale.set(1.2, 0.85, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Mouse
gltfLoader.load('./resources/models/Mouse.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 5;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the other floating objects
	const tableTopY = 3.5;
	const mouseX = 3;
	const mouseZ = -16.2;

	root.position.set(mouseX, tableTopY - box.min.y, mouseZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.15, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(mouseX, 0.03, mouseZ);
	shadow.scale.set(1.2, 0.8, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Cherry
gltfLoader.load('./resources/models/Cherry.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.0;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the other floating objects
	const tableTopY = 4.2;
	const cherryX = -8;
	const cherryZ = -16.8;

	root.position.set(cherryX, tableTopY - box.min.y, cherryZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.0, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(cherryX, 0.03, cherryZ);
	shadow.scale.set(1.0, 0.8, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.35);
    registerCollectible(root, shadow, someBox); 
});

// Ant
gltfLoader.load('./resources/models/Ant.glb', (gltf) => {
	const root = gltf.scene;
	scene.add(root);

	let box = new THREE.Box3().setFromObject(root);
	const center = box.getCenter(new THREE.Vector3());

	root.position.x += (0 - center.x);
	root.position.z += (0 - center.z);

	box = new THREE.Box3().setFromObject(root);
	root.position.y += (0 - box.min.y);

	box = new THREE.Box3().setFromObject(root);
	const size = box.getSize(new THREE.Vector3());
	const maxDim = Math.max(size.x, size.y, size.z);
	const desiredSize = 2.2;
	const scale = desiredSize / maxDim;
	root.scale.setScalar(scale);

	box = new THREE.Box3().setFromObject(root);

	// Same height as the other floating objects
	const tableTopY = 4;
	const antX = -14;
	const antZ = 1;

	root.position.set(antX, tableTopY - box.min.y, antZ);

	// Prominent fake shadow underneath
	const shadow = new THREE.Mesh(
		new THREE.CircleGeometry(1.0, 32),
		new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
			opacity: 0.4,
			depthWrite: false,
		})
	);
	shadow.rotation.x = -Math.PI / 2;
	shadow.position.set(antX, 0.03, antZ);
	shadow.scale.set(1.0, 0.75, 1);
	scene.add(shadow);

	const someBox = new THREE.Box3().setFromObject(root);
    someBox.expandByScalar(0.25);
    registerCollectible(root, shadow, someBox); 
});


function addBush(x, z, size = 6, rotationY = 0) {
	gltfLoader.load('./resources/models/Bush.glb', (gltf) => {
		const root = gltf.scene;
		scene.add(root);

		let box = new THREE.Box3().setFromObject(root);
		const center = box.getCenter(new THREE.Vector3());

		// Center in X/Z
		root.position.x += (0 - center.x);
		root.position.z += (0 - center.z);

		// Put on ground
		box = new THREE.Box3().setFromObject(root);
		root.position.y += (0 - box.min.y);

		// Scale
		box = new THREE.Box3().setFromObject(root);
		const bushSize = box.getSize(new THREE.Vector3());
		const maxDim = Math.max(bushSize.x, bushSize.y, bushSize.z);
		const scale = size / maxDim;
		root.scale.setScalar(scale);

		// Re-ground after scaling
		box = new THREE.Box3().setFromObject(root);
		root.position.y += (0 - box.min.y);

		// Final placement
		root.position.set(x, root.position.y, z);
		root.rotation.y = rotationY;

		// Collision
		const bushBox = new THREE.Box3().setFromObject(root);
		bushBox.expandByScalar(0.15);
		collisionBoxes.push(bushBox);
	});
}

function addBushesAroundEdgesEvenly() {
	const worldSize = 60;
	const half = worldSize / 2;

	// Keep bushes a bit inside the world bounds
	const edgeInset = 3.5;

	// 10 bushes per side = 40 total
	const bushesPerSide = 10;

	// Keep corners from getting crowded
	const cornerMargin = 5.5;

	const min = -half + cornerMargin;
	const max = half - cornerMargin;
	const spacing = (max - min) / (bushesPerSide - 1);

	for (let i = 0; i < bushesPerSide; i++) {
		const t = min + i * spacing;

		// Small jitter so they don't look perfectly grid-aligned
		const jitterAlong = THREE.MathUtils.randFloat(-0.8, 0.8);
		const jitterInward = THREE.MathUtils.randFloat(-0.6, 0.6);

		// Top
		addBush(
			t + jitterAlong,
			half - edgeInset + jitterInward,
			THREE.MathUtils.randFloat(5.8, 7.8),
			THREE.MathUtils.randFloat(0, Math.PI * 2)
		);

		// Bottom
		addBush(
			t + jitterAlong,
			-half + edgeInset + jitterInward,
			THREE.MathUtils.randFloat(5.8, 7.8),
			THREE.MathUtils.randFloat(0, Math.PI * 2)
		);

		// Left
		addBush(
			-half + edgeInset + jitterInward,
			t + jitterAlong,
			THREE.MathUtils.randFloat(5.8, 7.8),
			THREE.MathUtils.randFloat(0, Math.PI * 2)
		);

		// Right
		addBush(
			half - edgeInset + jitterInward,
			t + jitterAlong,
			THREE.MathUtils.randFloat(5.8, 7.8),
			THREE.MathUtils.randFloat(0, Math.PI * 2)
		);
	}
}

addBushesAroundEdgesEvenly();

	function render() {
		timer.update();

		if (resizeRendererToDisplaySize(renderer)) {
			const canvas = renderer.domElement;
			camera.aspect = canvas.clientWidth / canvas.clientHeight;
			camera.updateProjectionMatrix();
		}

		const delta = timer.getDelta();
		const elapsed = timer.getElapsed();

		grassMaterial.uniforms.time.value = elapsed;

		let nextX = camera.position.x;
		let nextZ = camera.position.z;

		if (controls.isLocked) {
			direction.z = Number(move.forward) - Number(move.backward);
			direction.x = Number(move.right) - Number(move.left);
			direction.normalize();

			const moveDistance = moveSpeed * delta;

			if (move.forward || move.backward) {
				const forward = new THREE.Vector3();
				camera.getWorldDirection(forward);
				forward.y = 0;
				forward.normalize();

				nextX += forward.x * direction.z * moveDistance;
				nextZ += forward.z * direction.z * moveDistance;
			}

			if (move.left || move.right) {
				const right = new THREE.Vector3();
				camera.getWorldDirection(right);
				right.y = 0;
				right.normalize();
				right.cross(camera.up).normalize();

				nextX += right.x * direction.x * moveDistance;
				nextZ += right.z * direction.x * moveDistance;
			}
		}

		// World boundary clamp
		nextX = THREE.MathUtils.clamp(nextX, minX, maxX);
		nextZ = THREE.MathUtils.clamp(nextZ, minZ, maxZ);

		// Resolve horizontal collisions one axis at a time
		const currentY = playerY;

		if (!collidesAt(nextX, currentY, camera.position.z)) {
			camera.position.x = nextX;
		}

		if (!collidesAt(camera.position.x, currentY, nextZ)) {
			camera.position.z = nextZ;
		}

		// Gravity + jump

        verticalVelocity -= gravity * delta;
    playerY += verticalVelocity * delta;

    if (playerY <= standingEyeHeight) {
	    playerY = standingEyeHeight;
	    verticalVelocity = 0;
	    isOnGround = true;
    } else {
	    isOnGround = false;
    }

camera.position.y = playerY;
checkCollectibles();

if (endSequenceStarted && ladybugRoot) {
	ladybugRoot.rotation.y += 0.8 * delta;
}

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}


	requestAnimationFrame(render);
}

main();