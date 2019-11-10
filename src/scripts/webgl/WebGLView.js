import * as THREE from 'three';
import glslify from 'glslify';
import {
	EffectComposer,
	BrightnessContrastEffect,
	EffectPass,
	RenderPass,
	ShaderPass,
	BlendFunction
} from 'postprocessing';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { FaceNormalsHelper, Float32BufferAttribute } from 'three';
import MainCrystal from './MainCrystal';
import Tweakpane from 'tweakpane';

function remap(t, old_min, old_max, new_min, new_max) {
	let old_range = old_max - old_min;
	let normalizedT = t - old_min;
	let normalizedVal = normalizedT / old_range;
	let new_range = new_max - new_min;
	let newVal = normalizedVal * new_range + new_min;
	return newVal;
}

export default class WebGLView {
	constructor(app) {
		this.app = app;

		this.init();
	}

	async init() {
		this.PARAMS = {
			edgesThickness: 3.0
		};

		this.pane = new Tweakpane();
		this.initThree();
		this.initParticlesRenderTarget();
		this.initObjects();
		this.initLights();
		this.initControls();
		await this.loadLogoTexture();
		// this.initPostProcessing();
		this.mainCrystal = new MainCrystal(this.PARAMS);
		this.addPaneParams();

		this.initRenderTri();

	}

	addPaneParams() {
		this.pane.addInput(this.PARAMS, 'edgesThickness', {
			min: 0.0,
			max: 10.0
		})
			.on('change', value => {
				this.mainCrystal.meshes.edges.material.uniforms.u_edgesThickness.value = value;
			});
	}

	initThree() {
		this.scene = new THREE.Scene();

		this.camera = new THREE.OrthographicCamera();

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.autoClear = true;

		this.clock = new THREE.Clock();
	}

	loadLogoTexture() {
		return new Promise((res, rej) => {
			let loader = new THREE.TextureLoader();

			loader.load('./logo-final-final.png', texture => {
				this.logoTexture = texture;
				res();
			});
		});
	}

	returnRenderTriGeometry() {
		const geometry = new THREE.BufferGeometry();

		// triangle in clip space coords
		const vertices = new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]);

		geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 2));

		return geometry;
	}

	initRenderTri() {
		// mostly taken from here: https://medium.com/@luruke/simple-postprocessing-in-three-js-91936ecadfb7

		this.resize();
		const geometry = this.returnRenderTriGeometry();

		const resolution = new THREE.Vector2();
		this.renderer.getDrawingBufferSize(resolution);

		this.RenderTriTarget = new THREE.WebGLRenderTarget(
			resolution.x,
			resolution.y,
			{
				format: THREE.RGBFormat,
				stencilBuffer: false,
				depthBuffer: true
			}
		);

		this.triMaterial = new THREE.RawShaderMaterial({
			fragmentShader: `
				precision highp float;
				uniform sampler2D uScene;
				uniform sampler2D uLogoTexture;
				uniform vec2 uResolution;
				uniform float uTime;
				
				void main() {
					vec2 uv = gl_FragCoord.xy / uResolution.xy;
					vec4 color = texture2D(uScene, uv);
					vec4 logoColor = texture2D(uLogoTexture, uv);
					
					vec3 refractVec1 = refract(vec3(0.0, 0.0, 1.0), logoColor.rgb, 0.2);
					vec3 refractVec2 = refract(vec3(0.05, 0.0, 1.0), logoColor.rgb, 0.2);
					vec3 refractVec3 = refract(vec3(-0.05, 0.0, 1.0), logoColor.rgb, 0.2);

					vec4 color1 = texture2D(uScene, uv + (refractVec1.xy * 0.5));
					vec4 color2 = texture2D(uScene, uv + (refractVec2.xy * 0.5));
					vec4 color3 = texture2D(uScene, uv + (refractVec3.xy * 0.5));

					vec4 chromAberrColor = vec4(color1.r, color2.g, color3.b, 1.0) * logoColor.a;

					chromAberrColor += color;
					
					gl_FragColor = vec4(chromAberrColor);
				}
			`,
			vertexShader: `
				precision highp float;
				attribute vec2 position;
				
				void main() {
					// Look ma! no projection matrix multiplication,
					// because we pass the values directly in clip space coordinates.
					gl_Position = vec4(position, 1.0, 1.0);
				}
			`,
			uniforms: {
				uScene: {
					type: 't',
					value: this.particlesRt.texture
				},
				uLogoTexture: {
					type: 't',
					value: this.logoTexture
				},
				uResolution: { value: resolution },
				uTime: {
					value: 0.0
				}
			}
		});

		console.log(this.particlesRt.texture);

		let renderTri = new THREE.Mesh(geometry, this.triMaterial);
		renderTri.frustumCulled = false;
		this.scene.add(renderTri);
	}

	initParticlesRenderTarget() {
		this.particlesRt = new THREE.WebGLRenderTarget(
			window.innerWidth,
			window.innerHeight
		);
		this.particlesRtCamera = new THREE.PerspectiveCamera(
			50,
			window.innerWidth / window.innerHeight,
			0.01,
			100
		);
		this.particlesRtCamera.position.z = 30;

		this.particlesRtScene = new THREE.Scene();
	}

	initControls() {
		this.trackball = new TrackballControls(
			this.camera,
			this.renderer.domElement
		);
		this.trackball.rotateSpeed = 2.0;
		this.trackball.enabled = true;
	}

	initLights() {
		this.pointLight = new THREE.PointLight(0xffffff, 1, 100);
		this.pointLight.position.set(0, 0, 50);
		this.particlesRtScene.add(this.pointLight);
	}

	initObjects() {
		this.particleCount = 100;
		this.particles = [];

		for (let i = 0; i < this.particleCount; i++) {
			let mesh = this.createMesh();
			this.randomizeTransform(mesh);
			this.addAttributes(mesh);
			this.particlesRtScene.add(mesh);
			// this.scene.add(mesh);

			this.particles.push(mesh);
		}
	}

	addAttributes(mesh) {
		mesh.speed = {
			rotation: Math.random() * 0.01,
			y: Math.random() * 0.03 + 0.01
		};
	}

	randomizeTransform(mesh) {
		/*
				x range:  -30 to 30
				y range:  -15 to 15
				z range: 10 to -50
		*/
		mesh.position.x = remap(Math.random(), 0, 1, -30, 30);
		mesh.position.y = remap(Math.random(), 0, 1, -15, 15);
		mesh.position.z = remap(Math.random(), 0, 1, -20, 10);

		mesh.rotation.x = Math.random() * 2 * Math.PI;
		mesh.rotation.y = Math.random() * 2 * Math.PI;
		mesh.rotation.z = Math.random() * 2 * Math.PI;
	}

	updateParticles() {
		for (let i = 0; i < this.particleCount; i++) {
			let particle = this.particles[i];

			particle.position.y += particle.speed.y;

			particle.rotation.x += particle.speed.rotation;
			particle.rotation.z += particle.speed.rotation;

			this.checkEdge(particle);
		}
	}

	checkEdge(particle) {
		if (particle.position.y > 15) {
			particle.position.y = -15;
		}
	}

	createMesh() {
		let geo = new THREE.TetrahedronBufferGeometry(1, 0);
		// let mat = new THREE.MeshPhongMaterial();
		// mat.shininess = 100;
		let mat = new THREE.MeshPhysicalMaterial({
			roughness: 0.5,
			metalness: 0.3,
			reflectivity: 1,
			clearcoat: 1,
			color: 0xffffff
		});
		return new THREE.Mesh(geo, mat);
	}

	initPostProcessing() {
		this.composer = new EffectComposer(this.renderer);
		this.composer.enabled = false;

		const renderPass = new RenderPass(this.scene, this.camera);
		renderPass.renderToScreen = false;

		const contrastEffect = new BrightnessContrastEffect({ contrast: 1 });
		const contrastPass = new EffectPass(this.camera, contrastEffect);
		contrastPass.renderToScreen = true;

		this.composer.addPass(renderPass);
		this.composer.addPass(contrastPass);

		// kickstart composer
		this.composer.render(1);
	}

	resize() {
		if (!this.renderer) return;
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.fovHeight =
			2 *
			Math.tan((this.camera.fov * Math.PI) / 180 / 2) *
			this.camera.position.z;
		this.fovWidth = this.fovHeight * this.camera.aspect;

		this.renderer.setSize(window.innerWidth, window.innerHeight);

		// this.composer.setSize(window.innerWidth, window.innerHeight);

		if (this.trackball) this.trackball.handleResize();
	}

	update() {
		const delta = this.clock.getDelta();
		const time = performance.now() * 0.0005;

		if (this.triMaterial) {
			this.triMaterial.uniforms.uTime.value = time;
		}

		if (this.particleCount) {
			this.updateParticles();
		}

		if (this.trackball) this.trackball.update();
	}


	draw() {
		if (this.mainCrystal) {
			// rotate crystals
			this.mainCrystal.meshes.edges.rotation.y += 0.005;
			this.mainCrystal.meshes.edges.rotation.z += 0.005;
			this.mainCrystal.meshes.normals.rotation.y += 0.005;
			this.mainCrystal.meshes.normals.rotation.z += 0.005;

			// render bg particles
			this.renderer.setRenderTarget(this.particlesRt);
			this.renderer.render(this.particlesRtScene, this.particlesRtCamera);
			this.renderer.setRenderTarget(null);

			// render crystal edges
			this.renderer.setRenderTarget(this.mainCrystal.rt.edges);
			this.renderer.render(this.mainCrystal.scenes.edges, this.mainCrystal.cameras.edges);
			this.renderer.setRenderTarget(null);

			// render crystal normal
			this.renderer.setRenderTarget(this.mainCrystal.rt.normals);
			this.renderer.render(this.mainCrystal.scenes.normals, this.mainCrystal.cameras.normals);
			this.renderer.setRenderTarget(null);

			this.renderer.render(this.scene, this.camera);
			// this.renderer.render(this.mainCrystal.scenes.normals, this.mainCrystal.cameras.normals);

		}
	}
}
