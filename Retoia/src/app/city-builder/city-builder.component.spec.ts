import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CityBuilderComponent } from './city-builder.component';

describe('CityBuilderComponent', () => {
  let component: CityBuilderComponent;
  let fixture: ComponentFixture<CityBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CityBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CityBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
