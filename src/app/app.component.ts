//////////////////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////
// I) Imports
//////////////////////////////////////////////////////////////////// ////////////////////////////////////////////////////////////////////

// Angular
import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';

// Other
import { Observable, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

// Databases
import { MakeCodes, MakeMotoCodes } from "../databases/Makes";
import { ModelCodes } from "../databases/Models";
import { SpecialMakeModelNames } from "../databases/SpecialMakeModelNames";
import { MatStepper } from '@angular/material/stepper';


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// III) Defines
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let INDEX_NONE: number = -1;
let STRING_NONE: string = "";
let STRING_ERROR: string = "ERROR";

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// VI) Interfaces
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


/////////////////////////////////
///// Errors Handling Price /////
const MakeModelWrong = 0;
const YearWrong = -1;
const HandFreeWrong = -2;
const NoPrice = -3;
const Private = -4;
const MultipleKeyFound = -5;
const YearImpossible = -6;
//Key Simple Impossible
const KeySimple_AES = -7;
const KeySimple_MQB = -8;
const KeySimple_HandFree = -9;
const KeySimple_Mercedes = -10;
const KeySimple_Card = -11;
const KeyImpossible = -12;
const MakeModelImpossible = -13;


export interface Resultat {
  Time: string;
  VehiculeType: string;
  Make: string;
  Model: string;
  Year: number | null;
  isHandFree: boolean;
  isKeySimple: boolean;
  IsError: boolean;
  Res: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'PrixManager';

  currentStepIndex = 0;

  VehiculeType: string = "";
  Make: string = STRING_NONE;
  Model: string = STRING_NONE;
  Year: number = null!;
  isTotalLoss: boolean = null!;

  @ViewChild("stepper") private stepper: MatStepper | undefined;

  public checkStep(step: number) {
    if (step == 0) {
      return this.VehiculeType != "" && this.VehiculeType != undefined && this.VehiculeType != null;
    }

    if (step == 1) {
      return this.Make !== "" && this.Model != "" && this.Year != null;
    }

    if (step == 2) {
      return this.isTotalLoss != null;
    }


    return false;
  }

  public CheckAndNext(step: number) {
    if (this.checkStep(step)) {
      this.stepper!.selectedIndex = ++step;
      this.currentStepIndex++;
    }
  }

  public CheckIfCompleted(step: number): boolean {
    return true;
    return (this.currentStepIndex >= step) && this.checkStep(step);
  }

  private _APIURL = 'https://script.google.com/macros/s/AKfycbz82u26yiYdvuNLR7HwKM4Q6MDaTYnKqeYdzMz9ox8BfOQnZFWWeFGA5uLl4deX1ACgAQ/exec';
  HttpClient: any;



  PostalCodeLocation: number = null!;
  DoorOpenned: boolean = false;

  isHandFree: boolean = false;
  isKeySimple: boolean = false;

  Price: number = null!;
  PriceStr: string = STRING_NONE;
  Searching: boolean = false;

  Resultats: Resultat[] = [];
  ShowHistory: boolean = false;

  ////////////////////
  // Forms Autocomplete

  FilteredOptionsMake: Observable<string[]> | undefined;
  FilteredOptionsModel: Observable<string[]> | undefined;

  ControlMake = new FormControl('');
  ControlModel = new FormControl('');

  ////////////////////////////////////////////////////////////////////
  // Constructor & ngOnInit functions

  constructor(private _httpClient: HttpClient) {
    this.HttpClient = _httpClient;
  }

  ngOnInit() {
    this.currentStepIndex = 0;
  }

  private SetModel(controlModel: FormControl, array: any[]): Observable<string[]> {
    return controlModel.valueChanges.pipe(startWith(''), map(value2 => this._filter(value2 || '', array)));
  }

  private _filter(value: string, array: string[]): string[] {
    const filterValue = value.toLowerCase();
    return array.filter(option => option.toLowerCase().includes(filterValue));
  }

  public MainModelUpdated() {
    if (this.VehiculeType === "Voiture") {
      this.FilteredOptionsModel = this.SetModel(this.ControlModel, this.GetModelKeysByMake(this.Make));
    }
  }

  public isMakeFromDBErrorMsg() {
    if (this.Make == "") {
      return true;
    }

    if (this.VehiculeType === "Moto") {
      return (this.GetMakesMotoKeys().includes(this.Make));
    }

    return (this.GetMakesKeys().includes(this.Make));
  }


  public isModelFromDBErrorMsg() {
    if (this.Model == "") {
      return true;
    }

    if (this.VehiculeType === "Moto") {
      return true;
    }
    return (this.GetModelKeysByMake(this.Make).includes(this.Model));
  }


  HandleVehiculeTypeChange(event: any) {
    this.Make = "";
    this.Model = "";
    this.Year = null!;

    if (event.value === undefined) {
      console.log("MDR")
      this.VehiculeType = "";
      return;
    }

    this.VehiculeType = event.value;

    if (this.VehiculeType === "Voiture") {
      this.FilteredOptionsMake = this.SetModel(this.ControlMake, this.GetMakesKeys());
      //this.FilteredOptionsModel = this.SetModel(this.ControlModel, this.GetModelKeys());
    }
    else if (this.VehiculeType === "Moto") {
      this.FilteredOptionsMake = this.SetModel(this.ControlMake, this.GetMakesMotoKeys());
    }
  }

  HandleIsTotalLossTypeChange(event: any) {

    if (event.value === undefined) {
      this.isTotalLoss = null!;
      return;
    }

    this.isTotalLoss = (event.value === "Je n'ai plus de clé.");
  }

  GetCorrectLabelStep3(): string {
    if (this.VehiculeType === 'Moto') {
      if (this.isTotalLoss == null) {
        return "";
      }
      if (this.isTotalLoss) {
        return "Malheureusement, on ne se déplace plus pour les pertes totales de clés de moto.";
      }
      else {
        return "Cela fera 70€ pour la clé simple, et il faudra nécessairement que vous veniez à notre boutique pour la programmation de la clé avec le véhicule,\n votre carte d’identité ainsi que votre carte grise.";
      }
    }

    if (this.VehiculeType === 'Voiture') {
      if (this.isTotalLoss == null) {
        return "";
      }
      if (this.isTotalLoss) {
        return " D’accord. Puisque vous n’avez plus aucune clé, il faudra nécessairement une intervention sur place pour vous en refaire une.\n Peu importe par qui vous passez pour résoudre votre problème Monsieur/Madame, sachez que ce ne sera pas possible autrement.";
      }
      else {
        return "Très bien, et est-ce que vous souhaitez refaire une clé simple, c’est-à-dire une clé qui permet juste d’ouvrir et démarrer la voiture, et qui n’a pas de boutons;\n ou est-ce que vous souhaitez une clé centralisée, qui permet de verrouiller et déverrouiller la voiture à distance ?";
      }
    }

    return "";
  }


  public SetValueTotalLoss(e: any) {
    this.isTotalLoss = e.checked;
  }

  public GetTotalLossSliderStr() {
    return (this.isTotalLoss) ? "Perte Totale" : "Double de clé";
  }

  public SetHandFree(e: any) {
    this.isHandFree = e.checked;
  }

  public GetHandFreeSliderStr() {
    return (this.isHandFree) ? "Main Libre" : "Non Main Libre";
  }

  public SetSimpleKey(e: any) {
    this.isKeySimple = e.checked;
  }

  public GetSimpleKeySliderStr() {
    return (this.isKeySimple) ? "Clé Simple" : "Clé Centralisée";
  }

  public SetDoorKey(e: any) {
    this.DoorOpenned = e.checked;
  }

  public GetDoorSliderStr() {
    return (this.DoorOpenned) ? "Porte Ouverte" : "Porte Fermée";
  }

  public GetModelKeysByMake(make: string): string[] {
    let keys: string[] = [];
    let makeCode = this.GetMakeCode(make.toLowerCase());
    for (const key in ModelCodes) {
      if (key.substring(0, 3) === makeCode) {
        let keySubstring = key.slice(4);
        keys.push(this.Capitalize(keySubstring));
      }
    }
    return keys;
  }

  private GetMakeCode(make: string): string {
    return MakeCodes[make];
  }

  public Capitalize(input: string): string {
    let inputLowerCase = input.toLowerCase();
    if (inputLowerCase in SpecialMakeModelNames) {
      return SpecialMakeModelNames[inputLowerCase];
    }
    let words = inputLowerCase.split(' ');
    let CapitalizedWords: string[] = [];
    words.forEach(element => {
      CapitalizedWords.push(element[0].toUpperCase() + element.slice(1, element.length));
    });
    return CapitalizedWords.join(' ');
  }

  public GetMakesKeys(): string[] {
    let keys: string[] = [];
    for (const key in MakeCodes) {
      keys.push(this.Capitalize(key));
    }
    return keys;
  }

  private GetMakesMotoKeys(): string[] {
    let keys: string[] = [];
    for (const key in MakeMotoCodes) {
      keys.push(this.Capitalize(key));
    }
    return keys;
  }

  private GetModelKeys(): string[] {
    let keys: string[] = [];
    for (const key in ModelCodes) {
      let keySubstring = key.slice(4);
      keys.push(this.Capitalize(keySubstring));
    }
    return keys;
  }

  GetPriceByHTTP() {

    let params = new HttpParams();
    params = params.append('make', this.Make);
    params = params.append('model', this.Model);
    params = params.append('year', this.Year);
    params = params.append('isHandFree', this.isHandFree);
    params = params.append('isKeySimple', this.isKeySimple);

    const headers = new HttpHeaders()
      .set('content-type', 'application/json')
      .set('Access-Control-Allow-Origin', '*')
      .set('Access-Control-Allow-Credentials', 'true')
      .set('Access-Control-Allow-Headers', 'Content-Type')
      .set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');

    const requestOptions = { params: params, headers: headers };

    this.Searching = true;

    return this.HttpClient.get(this._APIURL, requestOptions)
      .subscribe((data: any) => {
        var arr = Object.keys(data).map(key => ({ type: key, value: data[key] }));
        var res = Number(arr[0]['value'][0]);
        var resStr = "";
        var isError = false;
        if (res > 0) {
          this.Price = res;
          resStr = this.Price + " €";
        }
        else {
          isError = true;
          this.Price = null!;
          resStr = this.getErrorMessage(res, this.isHandFree);
        }

        var today = new Date();
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        this.Resultats.push({
          Time: time,
          VehiculeType: this.VehiculeType,
          Make: this.Make,
          Model: this.Model,
          Year: this.Year,
          isHandFree: this.isHandFree,
          isKeySimple: this.isKeySimple,
          Res: resStr,
          IsError: isError
        })

        this.PriceStr = resStr;
        this.Searching = false;
      });
  }

  public getErrorMessage(errorCode: number, isHandFree: boolean) {
    if (errorCode == MakeModelWrong) {
      return "Marque/Modèle introuvable final stock";
    }
    else if (errorCode == YearWrong) {
      return "Année introuvable dans final stock";
    }
    else if (errorCode == HandFreeWrong) {
      return (isHandFree) ? "Référence existe mais pas en main libre" : "Référence existe mais en main libre";
    }
    else if (errorCode == NoPrice) {
      return "Prix non renseigné";
    }
    else if (errorCode == Private) {
      return "Clé privée";
    }
    else if (errorCode == YearImpossible) {
      return "Année impossible";
    }
    else if (errorCode == KeySimple_AES) {
      return "Clé Simple Impossible - AES";
    }
    else if (errorCode == KeySimple_MQB) {
      return "Clé Simple Impossible - MQB";
    }
    else if (errorCode == KeySimple_HandFree) {
      return "Clé Simple Impossible - Main Libre";
    }
    else if (errorCode == KeySimple_Mercedes) {
      return "Clé Simple Impossible - Mercedes";
    }
    else if (errorCode == KeySimple_Card) {
      return "Clé Simple Impossible - Carte";
    }
    else if (errorCode == KeyImpossible) {
      return "Clé Impossible";
    }
    else if (errorCode == MultipleKeyFound) {
      return "Clé Multiple trouvé";
    }
    else if (errorCode == MakeModelImpossible) {
      return "Marque/Model invalide";
    }

    return errorCode.toString();
  }

  public GetStrFromBool(bool: boolean): string {
    return (bool) ? "X" : "";
  }

  public SearchForPrice() {
    if (!this.CheckData()) {
      return;
    }

    if (this.VehiculeType === "Moto") {
      var today = new Date();
      var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
      if (this.isKeySimple) {
        this.Resultats.push({
          Time: time,
          VehiculeType: this.VehiculeType,
          Make: this.Make,
          Model: this.Model,
          Year: this.Year,
          isHandFree: this.isHandFree,
          isKeySimple: this.isKeySimple,
          Res: "70 €",
          IsError: false
        });

        this.Price = 70;
        this.PriceStr = "70 €";
      }
      else {
        this.Resultats.push({
          Time: time,
          VehiculeType: this.VehiculeType,
          Make: this.Make,
          Model: this.Model,
          Year: this.Year,
          isHandFree: this.isHandFree,
          isKeySimple: this.isKeySimple,
          Res: "Pas possible",
          IsError: true
        });

        this.Price = null!;
        this.PriceStr = "Pas possible en clé centralisée";
      }
      return;
    }

    this.PriceStr = "";
    this.GetPriceByHTTP();
  }

  public CheckData(): boolean {
    if (this.Make === "" || this.Make === null) {
      alert("Marque incorrecte");
      return false;
    }
    if (this.Model === "" || this.Model === null) {
      alert("Modèle incorrecte");
      return false;
    }
    if (this.Year === null) {
      alert("Année incorrecte");
      return false;
    }

    return true;
  }
}
