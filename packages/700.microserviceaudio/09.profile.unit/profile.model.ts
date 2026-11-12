import type Profile from './fce/profile.interface.js'
import type { SeriesVoiceManifest } from './fce/profile.interface.js'
import type ProfileBit from './fce/profile.bit.js'

export class ProfileModel implements Profile {
    idx: string = '09.profile'
    vaultRoot: string = '../series-assets-audio'
    activeSeriesId: string = 'default'
    cachedManifestPath: string = ''
    lastMtimeMs: number = 0
    cachedManifest: SeriesVoiceManifest | null = null
    profilesProcessed: number = 0
    profileBits: Record<string, ProfileBit> = {}
}
