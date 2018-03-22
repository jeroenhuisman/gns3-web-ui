import {BehaviorSubject} from "rxjs/BehaviorSubject";

export abstract class DataSource<T> {
  protected data: T[] = [];
  protected dataChange: BehaviorSubject<T[]> = new BehaviorSubject<T[]>([]);

  public getItems(): T[] {
    return this.data;
  }

  public add(item: T) {
    this.data.push(item);
    this.dataChange.next(this.data);
  }

  public set(data: T[]) {
    this.data = data;
    this.dataChange.next(this.data);
  }

  public update(item: T) {
    const index = this.findIndex(item);
    if (index >= 0) {
      this.data[index] = item;
      this.dataChange.next(this.data);
    }
  }

  public remove(item: T) {
    const index = this.findIndex(item);
    if (index >= 0) {
      this.data.splice(index, 1);
      this.dataChange.next(this.data);
    }
  }

  public connect() {
    return this.dataChange;
  }

  protected abstract findIndex(item: T): number;
}
