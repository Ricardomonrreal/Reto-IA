import { Component } from '@angular/core';
import { CityBuilderComponent } from './city-builder/city-builder.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CityBuilderComponent],
  template: '<app-city-builder></app-city-builder>'
})
export class AppComponent {
  title = 'Retoia';
}