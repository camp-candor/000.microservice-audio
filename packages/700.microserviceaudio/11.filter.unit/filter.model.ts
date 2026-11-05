import type Filter from './fce/filter.interface.js'
import type FilterBit from './fce/filter.bit.js'

export class FilterModel implements Filter {
    idx: string = '11.filter'
    filtersProcessed: number = 0
    filterBits: Record<string, FilterBit> = {}
}
