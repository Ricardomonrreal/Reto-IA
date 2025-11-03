import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuNivelesComponent } from './menu-niveles.component';

describe('MenuNivelesComponent', () => {
  let component: MenuNivelesComponent;
  let fixture: ComponentFixture<MenuNivelesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuNivelesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuNivelesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
