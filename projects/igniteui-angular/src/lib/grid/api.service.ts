import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { cloneArray } from '../core/utils';
import { DataUtil } from '../data-operations/data-util';
import { IFilteringExpression, FilteringLogic } from '../data-operations/filtering-expression.interface';
import { ISortingExpression, SortingDirection } from '../data-operations/sorting-expression.interface';
import { IgxGridCellComponent } from './cell.component';
import { IgxColumnComponent } from './column.component';
import { IGridEditEventArgs, IgxGridComponent } from './grid.component';
import { IgxGridRowComponent } from './row.component';
import { IFilteringOperation, FilteringExpressionsTree, IFilteringExpressionsTree } from '../../public_api';

@Injectable()
export class IgxGridAPIService {

    public change: Subject<any> = new Subject<any>();
    protected state: Map<string, IgxGridComponent> = new Map<string, IgxGridComponent>();
    protected summaryCacheMap: Map<string, Map<string, any[]>> = new Map<string, Map<string, any[]>>();

    public register(grid: IgxGridComponent) {
        this.state.set(grid.id, grid);
    }

    public get(id: string): IgxGridComponent {
        return this.state.get(id);
    }

    public get_column_by_name(id: string, name: string): IgxColumnComponent {
        return this.get(id).columnList.find((col) => col.field === name);
    }

    public set_summary_by_column_name(id: string, name: string) {
        if (!this.summaryCacheMap.get(id)) {
            this.summaryCacheMap.set(id, new Map<string, any[]>());
        }
        const column = this.get_column_by_name(id, name);
        if (this.get(id).filteredData) {
            if (this.get(id).filteredData.length > 0) {
                this.calculateSummaries(id, column, this.get(id).filteredData.map((rec) => rec[column.field]));
            } else {
                this.calculateSummaries(id, column, this.get(id).filteredData.map((rec) => rec[column.field]));
            }
        } else {
            this.calculateSummaries(id, column, this.get(id).data.map((rec) => rec[column.field]));
        }
    }

    public get_summaries(id: string) {
        return this.summaryCacheMap.get(id);
    }

    public remove_summary(id: string, name?: string) {
        if (this.summaryCacheMap.has(id)) {
            if (!name) {
                this.summaryCacheMap.delete(id);
            } else {
                this.summaryCacheMap.get(id).delete(name);
            }
        }
    }

    public get_row_by_key(id: string, rowSelector: any): IgxGridRowComponent {
        const primaryKey = this.get(id).primaryKey;
        if (primaryKey !== undefined && primaryKey !== null) {
            return this.get(id).rowList.find((row) => row.rowData[primaryKey] === rowSelector);
        }
        return this.get(id).rowList.find((row) => row.index === rowSelector);
    }

    public get_row_by_index(id: string, rowIndex: number): IgxGridRowComponent {
        return this.get(id).rowList.find((row) => row.index === rowIndex);
    }

    public get_cell_by_field(id: string, rowSelector: any, field: string): IgxGridCellComponent {
        const row = this.get_row_by_key(id, rowSelector);
        if (row) {
            return row.cells.find((cell) => cell.column.field === field);
        }
    }

    public notify(id: string) {
        this.get(id).eventBus.next(true);
    }

    public get_cell_by_index(id: string, rowIndex: number, columnIndex: number): IgxGridCellComponent {
        const row = this.get_row_by_index(id, rowIndex);
        if (row) {
            return row.cells.find((cell) => cell.columnIndex === columnIndex);
        }
    }

    public get_cell_by_visible_index(id: string, rowIndex: number, columnIndex: number): IgxGridCellComponent {
        const row = this.get_row_by_index(id, rowIndex);
        if (row) {
            return row.cells.find((cell) => cell.visibleColumnIndex === columnIndex);
        }
    }

    public update(id: string, cell: IgxGridCellComponent): void {
        const index = this.get(id).data.indexOf(cell.row.rowData);
        this.get(id).data[index][cell.column.field] = cell.value;
    }

    public update_row(value: any, id: string, row: IgxGridRowComponent): void {
        const index = this.get(id).data.indexOf(row.rowData);
        const args: IGridEditEventArgs = { row, cell: null, currentValue: this.get(id).data[index], newValue: value };
        this.get(id).onEditDone.emit(args);
        this.get(id).data[index] = args.newValue;
    }

    public sort(id: string, fieldName: string, dir: SortingDirection, ignoreCase: boolean): void {
        const sortingState = cloneArray(this.get(id).sortingExpressions, true);

        this.prepare_sorting_expression(sortingState, fieldName, dir, ignoreCase);
        this.get(id).sortingExpressions = sortingState;
    }

    public sort_multiple(id: string, expressions: ISortingExpression[]): void {
        const sortingState = cloneArray(this.get(id).sortingExpressions, true);

        for (const each of expressions) {
            this.prepare_sorting_expression(sortingState, each.fieldName, each.dir, each.ignoreCase);
        }

        this.get(id).sortingExpressions = sortingState;
    }

    public filter(id: string, fieldName: string, term, condition: IFilteringOperation, ignoreCase: boolean);
    public filter(id: string, fieldName: string, term, filteringExpressionsTree: IFilteringExpressionsTree, ignoreCase: boolean);
    filter(id: string, fieldName: string, term, conditionOrExpressionsTree: IFilteringOperation | IFilteringExpressionsTree, ignoreCase: boolean) {
        const grid = this.get(id);
        const filteringTree = grid.filteringExpressionsTree;
        if (grid.paging) {
            grid.page = 0;
        }

        if (conditionOrExpressionsTree instanceof FilteringExpressionsTree) {
            const expressionsTree = conditionOrExpressionsTree as IFilteringExpressionsTree;
            this.prepare_filtering_expression(filteringTree, fieldName, term, expressionsTree, ignoreCase);
        } else {
            const condition = conditionOrExpressionsTree as IFilteringOperation;
            this.prepare_filtering_expression(filteringTree, fieldName, term, condition, ignoreCase);
        }

        grid.filteringExpressionsTree = filteringTree;
    }

    public filter_multiple(id: string, expressions: IFilteringExpression[]) {
        const grid = this.get(id);
        const filteringTree = grid.filteringExpressionsTree;
        if (grid.paging) {
            grid.page = 0;
        }

        for (const each of expressions) {
            this.prepare_filtering_expression(filteringTree, each.fieldName,
                                              each.searchVal, each.condition, each.ignoreCase);
        }
        grid.filteringExpressionsTree = filteringTree;
    }

    public filter_global(id, term, condition, ignoreCase) {
        const grid = this.get(id);
        const filteringTree = grid.filteringExpressionsTree;
        if (grid.paging) {
            grid.page = 0;
        }

        for (const column of grid.columns) {
            if (condition) {
                this.prepare_filtering_expression(filteringTree, column.field, term,
                    condition, ignoreCase || column.filteringIgnoreCase);
            } else {
                this.prepare_filtering_expression(filteringTree, column.field, term,
                    column.filteringExpressionsTree, ignoreCase || column.filteringIgnoreCase);
            }
        }

        grid.filteringExpressionsTree = filteringTree;
    }

    public clear_filter(id, fieldName) {
        const grid = this.get(id);
        const filteringState = grid.filteringExpressionsTree;
        const index = filteringState.filteringOperands.findIndex((expr) => {
            if (expr instanceof FilteringExpressionsTree) {
                return this.isFilteringExpressionsTreeForColumn(expr, fieldName)
            }

            return (expr as IFilteringExpression).fieldName === fieldName;
        });

        if (index > -1) {
            filteringState.filteringOperands.splice(index, 1);
            // TODO: bvk - test if we need the following code
            //grid.filteringExpressions = filteringState;
        }
        grid.filteredData = null;
    }

    protected isFilteringExpressionsTreeForColumn(expressionsTree: IFilteringExpressionsTree, fieldName: string): boolean {
        for (let i = 0; i < expressionsTree.filteringOperands.length; i++) {
            let expr = expressionsTree.filteringOperands[i];
            if ((expr instanceof FilteringExpressionsTree)) {
                return this.isFilteringExpressionsTreeForColumn(expr, fieldName);
            } else {
                return (expr as IFilteringExpression).fieldName === fieldName;
            }
        }

        return false;
    }

    protected calculateSummaries(id: string, column, data) {
        if (!this.summaryCacheMap.get(id).get(column.field)) {
            this.summaryCacheMap.get(id).set(column.field,
                column.summaries.operate(data));
        }
    }

    public clear_sort(id, fieldName) {
        const sortingState = this.get(id).sortingExpressions;
        const index = sortingState.findIndex((expr) => expr.fieldName === fieldName);
        if (index > -1) {
            sortingState.splice(index, 1);
            this.get(id).sortingExpressions = sortingState;
        }
    }

    protected prepare_filtering_expression(filteringState: IFilteringExpressionsTree, fieldName: string, searchVal,
        condition: IFilteringOperation, ignoreCase: boolean);
    protected prepare_filtering_expression(filteringState: IFilteringExpressionsTree, fieldName: string, searchVal,
        filteringExpressionsTree: IFilteringExpressionsTree, ignoreCase: boolean);
    protected prepare_filtering_expression(filteringState: IFilteringExpressionsTree, fieldName: string, searchVal,
        conditionOrExpressionsTree: IFilteringOperation | IFilteringExpressionsTree, ignoreCase: boolean) {

        const expressionOrExpressionsTreeForField = filteringState.filteringOperands.find((expr) => {
            if (expr instanceof FilteringExpressionsTree) {
                return this.isFilteringExpressionsTreeForColumn(expr, fieldName)
            }

            return (expr as IFilteringExpression).fieldName === fieldName;
        });

        let newExpressionsTree;
        const expressionsTree = conditionOrExpressionsTree as IFilteringExpressionsTree;
        const condition = conditionOrExpressionsTree as IFilteringOperation;
        const newExpression: IFilteringExpression = { fieldName, searchVal, condition, ignoreCase };

        if (!expressionOrExpressionsTreeForField) {
            // no expressions tree found for this field
            if (expressionsTree) {
                filteringState.filteringOperands.push(expressionsTree);
            } else if (condition) {
                // create expressions tree for this field and add the new expression to it
                newExpressionsTree = new FilteringExpressionsTree(filteringState.operator);
                newExpressionsTree.filteringOperands.push(newExpression);
                filteringState.filteringOperands.push(newExpressionsTree);
            }
        } else {
            // expression or expressions tree found for this field
            const oldExpressionsTreeIndex = filteringState.filteringOperands.findIndex((expr) => expr === expressionOrExpressionsTreeForField);

            if (expressionsTree) {
                // replace the existing expressions tree for this field with the new one passed as parameter
                filteringState.filteringOperands.splice(oldExpressionsTreeIndex, 1, expressionsTree);
            } else if (condition) {
                // a new expression have to be added
                if (expressionOrExpressionsTreeForField instanceof FilteringExpressionsTree) {
                    // add it to the existing list of expressions for this field
                    expressionOrExpressionsTreeForField.filteringOperands.push(newExpression);
                } else {
                    // the element found for this field is an expression but it should be an expressions tree
                    // so create new expressions tree for this field
                    newExpressionsTree = new FilteringExpressionsTree(filteringState.operator);
                    newExpressionsTree.filteringOperands.push(newExpression);
                    // and replace the old expression with the new expressions tree
                    filteringState.filteringOperands.splice(oldExpressionsTreeIndex, 1, newExpressionsTree);
                }
            }
        }
    }

    protected prepare_sorting_expression(state, fieldName, dir, ignoreCase) {

        if (dir === SortingDirection.None) {
            state.splice(state.findIndex((expr) => expr.fieldName === fieldName), 1);
            return;
        }

        const expression = state.find((expr) => expr.fieldName === fieldName);

        if (!expression) {
            state.push({ fieldName, dir, ignoreCase });
        } else {
            Object.assign(expression, { fieldName, dir, ignoreCase });
        }
    }
}
