import type FilterBit from './filter.bit.js'

export default interface Filter {
    idx: string
    filtersProcessed: number
    filterBits: Record<string, FilterBit>
}
