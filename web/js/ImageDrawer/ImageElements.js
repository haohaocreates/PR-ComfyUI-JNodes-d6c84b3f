import { api } from "/scripts/api.js";
import { $el } from "/scripts/ui.js";

import { utilitiesInstance } from "../common/Utilities.js";

import { isPointerDown } from "../common/EventManager.js";
import { createModal } from "../common/ModalManager.js";

import { setting_VideoPlaybackOptions } from "../common/SettingsManager.js";
import { onScrollVideo, setVideoPlaybackRate, setVideoVolume, toggleVideoFullscreen } from "../common/VideoControl.js";

import * as ImageElementUtils from "./ImageElementUtils.js";

import { imageDrawerComponentManagerInstance } from "./Core/ImageDrawerModule.js";


export async function createImageElementFromFileInfo(fileInfo) {
	if (!fileInfo) { return; }
	let href = `/jnodes_view_image?`;
	if (fileInfo.filename) {
		href += `filename=${encodeURIComponent(fileInfo.filename)}&`;
	}
	if (fileInfo.type) {
		href += `type=${fileInfo.type}&`;
	}
	if (fileInfo.subdirectory || fileInfo.subfolder) {
		href += `subfolder=${encodeURIComponent(fileInfo.subdirectory || fileInfo.subfolder || "")}&`;
	}

	href += `t=${+new Date()}`; // Add Timestamp

	fileInfo.href = href;
	const bIsVideoFormat = fileInfo.file?.is_video || fileInfo.filename.endsWith(".mp4"); // todo: fetch acceptable video types from python

	const imageElement =
		$el("div.imageElement", {
			bComplete: false,
			style: {
				borderRadius: '4px',
				transition: "100ms",
			}
		});

	imageElement.fileInfo = fileInfo;
	imageElement.bIsVideoFormat = bIsVideoFormat;

	imageElement.mouseOverEvent = function (event) {
		if (!event) { return; }

		// Only show tooltip if a mouse button is not being held
		if (!isPointerDown() && !ImageElementUtils.toolButtonContainer?.contains(event.target)) {
			ImageElementUtils.addCheckboxSelectorToImageElement(imageElement);
			ImageElementUtils.addToolButtonToImageElement(imageElement);
			ImageElementUtils.updateAndShowTooltip(imageElement.tooltipWidget, imageElement);
		}
	}
	imageElement.addEventListener("mouseover", imageElement.mouseOverEvent);

	imageElement.mouseOutEvent = function (event) {
		if (!event) { return; }

		ImageElementUtils.hideToolTip();

		// If the new actively moused over element is not a child of imageElement, then hide the button
		if (!imageElement.contains(event.relatedTarget)) {
			ImageElementUtils.removeAndHideToolButtonFromImageElement(imageElement);
			ImageElementUtils.hideImageElementCheckboxSelector(imageElement);
		}
	}
	imageElement.addEventListener("mouseout", imageElement.mouseOutEvent);

	imageElement.deleteItem = async function (bAlsoRemoveFromImageList = true, bNotifyImageListChanged = true) {

		const deleteCall = imageElement.fileInfo.href.replace("jnodes_view_image", "jnodes_delete_item");
		const response = await api.fetchApi(deleteCall, { method: "DELETE" });

		let jsonResponse;
		try {
			const decodedString = await utilitiesInstance.decodeReadableStream(response.body);
			jsonResponse = JSON.parse(decodedString)
		} catch (error) { console.error("Could not parse json from response."); }

		let bSuccess = jsonResponse && jsonResponse.success && jsonResponse.success == true;

		if (bAlsoRemoveFromImageList) {
			imageElement.removeItemFromImageList(bNotifyImageListChanged);
		}

		return bSuccess;
	}

	imageElement.removeItemFromImageList = async function (bNotifyImageListChanged = true) {

		const imageDrawerListInstance = imageDrawerComponentManagerInstance.getComponentByName("ImageDrawerList");

		if (bNotifyImageListChanged) {
			imageDrawerListInstance.notifyStartChangingImageList();
		}

		imageDrawerListInstance.removeElementFromImageList(imageElement); // If it was deleted, remove it from the list

		if (bNotifyImageListChanged) {
			imageDrawerListInstance.notifyFinishChangingImageList();
		}
	}

	const img = $el(bIsVideoFormat ? "video" : "img", {
		// Store the image source as a data attribute for easy access
		dataSrc: href,
		preload: "metadata",
		lastSeekTime: 0.0,
		style: {
			transition: "100ms",
			cursor: bIsVideoFormat ? "default" : "pointer"
		},
		onload: () => { ImageElementUtils.onLoadImageElement(imageElement); }, // Still / animated images
		onloadedmetadata: () => { ImageElementUtils.onLoadImageElement(imageElement); }, // Videos
		onclick: async (e) => {
			e.preventDefault();

			if (bIsVideoFormat) {
				if (img && img.togglePlayback) {
					img.togglePlayback();
				}
			} else {
				function createModalContent() {
					const modalImg = $el("img", {
						src: href,
						style: {
							position: 'relative',
							width: '99vw',
							height: '99vh',
							objectFit: 'contain',
							display: 'block',
							margin: 'auto',
						},
					});

					// Create modal content
					const modalContent = document.createElement("div");
					modalContent.style.position = 'absolute';
					modalContent.style.display = "inline-block";
					modalContent.style.left = "50%";
					modalContent.style.top = "50%";
					modalContent.style.transform = "translate(-50%, -50%)";
					modalContent.style.maxWidth = "99%";
					modalContent.style.maxHeight = "99%";
					modalContent.style.overflow = "hidden";

					modalContent.appendChild(modalImg);

					return modalContent;
				}
				createModal(createModalContent());
			}
		},
		ondblclick: async (e) => {
			e.preventDefault();

			if (bIsVideoFormat) {
				if (img) {
					toggleVideoFullscreen(img);
				}
			}
		}
	});

	imageElement.img = img;

	img.forceLoad = function () {
		img.src = img.dataSrc;

		if (bIsVideoFormat) {
			setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate); // This gets reset when src is reset
		}
	}

	img.initVideo = function () {

		img.type = fileInfo.file?.format || undefined;
		img.autoplay = false; // Start false, will autoplay via observer
		img.loop = setting_VideoPlaybackOptions.value.loop;
		img.controls = setting_VideoPlaybackOptions.value.controls;
		img.muted = setting_VideoPlaybackOptions.value.muted;
		setVideoVolume(img, setting_VideoPlaybackOptions.value.defaultVolume);
		setVideoPlaybackRate(img, setting_VideoPlaybackOptions.value.defaultPlaybackRate);
	}

	imageElement.forceLoad = function () {
		img.forceLoad();
	}

	if (fileInfo.bShouldForceLoad) {
		imageElement.forceLoad(); // Immediately load img if we don't want to lazy load (like in feed)
	}

	// Placeholder dimensions
	if (fileInfo.file?.metadata_read) {
		if (!imageElement.displayData) {
			imageElement.displayData = {};
		}
		imageElement.displayData.FileDimensions = fileInfo.file.dimensions;

		imageElement.displayData.AspectRatio = imageElement.displayData.FileDimensions[0] / imageElement.displayData.FileDimensions[1];
		imageElement.style.aspectRatio = imageElement.displayData.AspectRatio;
	} else {
		//If we can't properly placehold, load the whole image now instead of later
		imageElement.forceLoad();
	}

	if (!imageElement.displayData) {
		imageElement.displayData = {};
	}

	if (bIsVideoFormat) {

		imageElement.addEventListener('wheel', (event) => {
			if (setting_VideoPlaybackOptions.value.useWheelSeek) {
				onScrollVideo(img, event, setting_VideoPlaybackOptions.value.invertWheelSeek);
			}
		});

		img.initVideo();

		imageElement.displayData.DurationInSeconds = fileInfo.file?.duration_in_seconds;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;
		imageElement.displayData.FrameCount = fileInfo.file?.frame_count;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;
		imageElement.displayData.FramesPerSecond = fileInfo.file?.fps;

		imageElement.bIsVideoFormat = bIsVideoFormat;
	}

	imageElement.appendChild(img);

	// Sorting meta information
	imageElement.filename = fileInfo.filename;
	imageElement.fileType = imageElement.filename.split(".")[1];
	imageElement.file_age = fileInfo.file?.file_age || utilitiesInstance.getCurrentSecondsFromEpoch(); // todo: fix for feed images
	imageElement.subdirectory = fileInfo.subdirectory || null;
	imageElement.displayData.FileSize = fileInfo.file?.file_size || -1;

	imageElement.displayData = utilitiesInstance.SortJsonObjectByKeys(imageElement.displayData);

	imageElement.searchTerms = href; // Search terms to start with, onload will add more

	imageElement.draggable = true;
	imageElement.addEventListener('dragstart', function (event) {
		fileInfo.displayData = imageElement.displayData;
		event.dataTransfer.setData('text/jnodes_image_drawer_payload', `${JSON.stringify(fileInfo)}`);
		ImageElementUtils.removeAndHideToolButtonFromImageElement(imageElement);
		ImageElementUtils.hideToolTip();
	});

	// Selection
	ImageElementUtils.addCheckboxSelectorToImageElement(imageElement);
	ImageElementUtils.hideImageElementCheckboxSelector(imageElement);

	return imageElement;
}