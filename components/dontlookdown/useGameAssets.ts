'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isAvatarPath, resolveAvatarSrc } from '@/lib/utils/playerDisplay'
import {
    type DLDPlayer,
    type PowerUpType,
    PLATFORM_IMAGE_COUNT,
    PLATFORM_PROP_NAMES,
    type PlatformPropName,
    BACKDROP_LAYER_NAMES,
    type BackdropLayerName,
    SPAWNABLE_POWERUP_TYPES,
    getPlatformImagePath,
    getPlatformPropPath,
    getBackdropLayerPath,
    getPowerUpImagePath,
} from '@/lib/game/dontlookdown'

/**
 * 점프점프 캔버스가 그리는 이미지들을 미리 받아 ref에 담아 둔다.
 * 발판·장식·배경 레이어·파워업은 마운트 때 한 번, 아바타는 플레이어 목록이 바뀔 때마다 새 것만 추가.
 * 이미지 크기는 발판 박스에 영향을 주지 않는다. 박스는 맵 생성 값 그대로, 그림만 그 폭에 맞춘다.
 */
export function useGameAssets(characterImage: string, players: DLDPlayer[]) {
    const platformImagesRef = useRef<Record<number, HTMLImageElement>>({})
    const propImagesRef = useRef<Partial<Record<PlatformPropName, HTMLImageElement>>>({})
    const backdropImagesRef = useRef<Partial<Record<BackdropLayerName, HTMLImageElement>>>({})
    const powerUpImagesRef = useRef<Partial<Record<PowerUpType, HTMLImageElement>>>({})
    const avatarImagesRef = useRef<Record<string, HTMLImageElement>>({})

    useEffect(() => {
        for (let i = 1; i <= PLATFORM_IMAGE_COUNT; i++) {
            const img = document.createElement('img')
            img.onload = () => {
                platformImagesRef.current[i] = img
            }
            img.src = getPlatformImagePath(i)
        }
        for (const name of PLATFORM_PROP_NAMES) {
            const img = document.createElement('img')
            img.onload = () => {
                propImagesRef.current[name] = img
            }
            img.src = getPlatformPropPath(name)
        }
        for (const name of BACKDROP_LAYER_NAMES) {
            const img = document.createElement('img')
            img.onload = () => {
                backdropImagesRef.current[name] = img
            }
            img.src = getBackdropLayerPath(name)
        }
    }, [])

    useEffect(() => {
        for (const type of SPAWNABLE_POWERUP_TYPES) {
            const img = document.createElement('img')
            img.onload = () => {
                powerUpImagesRef.current[type] = img
            }
            img.src = getPowerUpImagePath(type)
        }
    }, [])

    useEffect(() => {
        const avatarPaths = new Set<string>()
        const normalizedCharacterImage = characterImage.trim()
        if (isAvatarPath(normalizedCharacterImage)) {
            avatarPaths.add(resolveAvatarSrc(normalizedCharacterImage))
        }
        for (const player of players) {
            const avatar = String(player.avatar || '').trim()
            if (isAvatarPath(avatar)) {
                avatarPaths.add(resolveAvatarSrc(avatar))
            }
        }

        avatarPaths.forEach((avatarPath) => {
            if (avatarImagesRef.current[avatarPath]) return
            const img = document.createElement('img')
            img.src = avatarPath
            avatarImagesRef.current[avatarPath] = img
        })
    }, [characterImage, players])

    const getAvatarImage = useCallback((avatar: string) => {
        const normalized = avatar.trim()
        if (!isAvatarPath(normalized)) return undefined
        return avatarImagesRef.current[resolveAvatarSrc(normalized)]
    }, [])

    return {
        platformImagesRef,
        propImagesRef,
        backdropImagesRef,
        powerUpImagesRef,
        getAvatarImage,
    }
}
